import { useState, useEffect, useCallback, useMemo } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChecklistTaskCard } from './ChecklistTaskCard';
import { supabase } from '@/integrations/supabase/client';
import { useProperty } from '@/hooks/useProperty';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Loader2, Send } from 'lucide-react';
import { startOfWeek, startOfMonth, format } from 'date-fns';

type Frequency = 'daily' | 'weekly' | 'monthly';

interface Checklist {
  id: string;
  frequency: string;
  category: string;
  title: string;
  description: string | null;
  sort_order: number;
  requires_photo: boolean;
  notify_role: string[];
  inventory_item: string | null;
}

interface TaskInstance {
  id: string;
  checklist_id: string;
  status: string;
  assigned_to: string | null;
  completed_by: string | null;
  completed_at: string | null;
  photo_path: string | null;
  notes: string | null;
  urgency_level: number;
  // joined
  title: string;
  description: string | null;
  requires_photo: boolean;
}

interface StaffMember {
  user_id: string;
  full_name: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  entrance: '🚪 Entrance & Curb Appeal',
  sparkle: '✨ The Sparkle Factor',
  hygiene: '🧼 Hygiene & Dining',
  deep_clean: '🧹 Internal Deep Clean',
  kitchen: '🍳 Kitchen & Bar',
  organization: '📦 Organization',
  mechanical: '🔧 The Grease Run',
  aesthetics: '🎨 Paint & Polish',
  electrical: '💡 Electrical & Safety',
  collaboration: '🤝 Team Collaboration',
};

function getPeriodDate(frequency: Frequency): string {
  const now = new Date();
  if (frequency === 'daily') return format(now, 'yyyy-MM-dd');
  if (frequency === 'weekly') return format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  return format(startOfMonth(now), 'yyyy-MM-dd');
}

export function HousekeepingChecklist() {
  const { selectedProperty } = useProperty();
  const { canWrite, user } = useAuth();
  const [frequency, setFrequency] = useState<Frequency>('daily');
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [instances, setInstances] = useState<TaskInstance[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [noticedNote, setNoticedNote] = useState('');

  const periodDate = useMemo(() => getPeriodDate(frequency), [frequency]);
  const propertyId = selectedProperty?.id;

  const fetchData = useCallback(async () => {
    if (!propertyId) return;
    setLoading(true);
    try {
      // Fetch checklists (global + property-specific)
      const { data: checklistData } = await supabase
        .from('housekeeping_checklists')
        .select('*')
        .eq('frequency', frequency)
        .eq('is_active', true)
        .or(`property_id.eq.${propertyId},property_id.is.null`)
        .order('sort_order');

      const lists = (checklistData || []) as Checklist[];
      setChecklists(lists);

      // Fetch existing instances
      const { data: instanceData } = await supabase
        .from('housekeeping_task_instances')
        .select('*')
        .eq('property_id', propertyId)
        .eq('period_date', periodDate)
        .in('checklist_id', lists.map(c => c.id));

      const existingInstances = (instanceData || []) as any[];

      // Auto-generate missing instances
      const existingChecklistIds = new Set(existingInstances.map((i: any) => i.checklist_id));
      const missingChecklists = lists.filter(c => !existingChecklistIds.has(c.id));

      if (missingChecklists.length > 0 && canWrite) {
        const newInstances = missingChecklists.map(c => ({
          checklist_id: c.id,
          property_id: propertyId,
          period_date: periodDate,
          status: 'pending',
          urgency_level: 1,
        }));

        const { data: inserted } = await supabase
          .from('housekeeping_task_instances')
          .insert(newInstances)
          .select('*');

        if (inserted) {
          existingInstances.push(...inserted);
        }
      }

      // Merge checklist info into instances
      const merged: TaskInstance[] = existingInstances.map((inst: any) => {
        const cl = lists.find(c => c.id === inst.checklist_id);
        return {
          ...inst,
          title: cl?.title || 'Unknown Task',
          description: cl?.description || null,
          requires_photo: cl?.requires_photo || false,
        };
      });

      setInstances(merged);

      // Fetch staff
      const { data: staffData } = await supabase
        .from('user_roles')
        .select('user_id, profiles:profiles(full_name)')
        .in('role', ['admin', 'manager', 'front_desk']);

      setStaff((staffData || []).map((s: any) => ({
        user_id: s.user_id,
        full_name: Array.isArray(s.profiles) ? s.profiles[0]?.full_name : s.profiles?.full_name,
      })));
    } catch (err) {
      console.error('Checklist fetch error:', err);
      toast.error('Failed to load checklists');
    } finally {
      setLoading(false);
    }
  }, [propertyId, frequency, periodDate, canWrite]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime
  useEffect(() => {
    if (!propertyId) return;
    const channel = supabase
      .channel('hk-checklist-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'housekeeping_task_instances',
        filter: `property_id=eq.${propertyId}`,
      }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [propertyId, fetchData]);

  const handleToggleComplete = async (taskId: string, completed: boolean) => {
    const updates: Record<string, any> = {
      status: completed ? 'completed' : 'pending',
      completed_by: completed ? user?.id : null,
      completed_at: completed ? new Date().toISOString() : null,
    };

    const { error } = await supabase
      .from('housekeeping_task_instances')
      .update(updates)
      .eq('id', taskId);

    if (error) {
      toast.error('Failed to update task');
      return;
    }

    // Check notify_role
    if (completed) {
      const task = instances.find(t => t.id === taskId);
      const checklist = checklists.find(c => c.id === task?.checklist_id);
      if (checklist?.notify_role?.length) {
        await supabase.from('notifications').insert({
          property_id: propertyId,
          title: `Housekeeping: ${checklist.title} completed`,
          message: `Task "${checklist.title}" was completed by staff.`,
          category: 'maintenance',
          priority: 'medium',
          target_roles: checklist.notify_role,
          type: 'maintenance',
        } as any);
      }
    }

    fetchData();
  };

  const handleAssign = async (taskId: string, staffId: string) => {
    await supabase.from('housekeeping_task_instances').update({ assigned_to: staffId, status: 'in_progress' }).eq('id', taskId);
    fetchData();
  };

  const handleUrgencyChange = async (taskId: string, level: number) => {
    await supabase.from('housekeeping_task_instances').update({ urgency_level: level }).eq('id', taskId);
    fetchData();
  };

  const handlePhotoUploaded = (taskId: string, path: string) => {
    setInstances(prev => prev.map(t => t.id === taskId ? { ...t, photo_path: path } : t));
  };

  const handleSubmitNote = async () => {
    if (!noticedNote.trim() || !propertyId) return;
    // Find or create a "collaboration" checklist, or just log as a note on the first pending task
    // For simplicity, insert a notification
    await supabase.from('notifications').insert({
      property_id: propertyId,
      title: `Housekeeping Note: "I Noticed"`,
      message: noticedNote.trim(),
      category: 'maintenance',
      priority: 'medium',
      target_roles: ['admin', 'manager'],
      type: 'maintenance',
    } as any);
    toast.success('"I Noticed" note sent to managers');
    setNoticedNote('');
  };

  // Group instances by category
  const groupedByCategory = useMemo(() => {
    const groups: Record<string, TaskInstance[]> = {};
    instances.forEach(inst => {
      const cl = checklists.find(c => c.id === inst.checklist_id);
      const cat = cl?.category || 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(inst);
    });
    // Sort by checklist sort_order within each group
    Object.values(groups).forEach(arr =>
      arr.sort((a, b) => {
        const clA = checklists.find(c => c.id === a.checklist_id);
        const clB = checklists.find(c => c.id === b.checklist_id);
        return (clA?.sort_order || 0) - (clB?.sort_order || 0);
      })
    );
    return groups;
  }, [instances, checklists]);

  const totalTasks = instances.length;
  const completedTasks = instances.filter(t => t.status === 'completed').length;
  const overallProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  if (!propertyId) {
    return <div className="text-center py-8 text-muted-foreground">Select a property to view checklists.</div>;
  }

  return (
    <div className="space-y-4">
      {/* Frequency Tabs */}
      <Tabs value={frequency} onValueChange={(v) => setFrequency(v as Frequency)}>
        <TabsList>
          <TabsTrigger value="daily">Daily</TabsTrigger>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Overall Progress */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              {frequency === 'daily' ? "Today's" : frequency === 'weekly' ? "This Week's" : "This Month's"} Progress
            </span>
            <span className="text-sm text-muted-foreground">{completedTasks}/{totalTasks} tasks</span>
          </div>
          <Progress value={overallProgress} className="h-2" />
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Category Sections */}
          {Object.entries(groupedByCategory).map(([category, tasks]) => {
            const catCompleted = tasks.filter(t => t.status === 'completed').length;
            const catProgress = tasks.length > 0 ? Math.round((catCompleted / tasks.length) * 100) : 0;

            return (
              <Card key={category}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{CATEGORY_LABELS[category] || category}</CardTitle>
                    <span className="text-xs text-muted-foreground">{catCompleted}/{tasks.length}</span>
                  </div>
                  <Progress value={catProgress} className="h-1.5" />
                </CardHeader>
                <CardContent className="space-y-2">
                  {tasks.map(task => (
                    <ChecklistTaskCard
                      key={task.id}
                      task={task}
                      staff={staff}
                      canWrite={canWrite}
                      onToggleComplete={handleToggleComplete}
                      onAssign={handleAssign}
                      onUrgencyChange={handleUrgencyChange}
                      onPhotoUploaded={handlePhotoUploaded}
                    />
                  ))}
                </CardContent>
              </Card>
            );
          })}

          {instances.length === 0 && !loading && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No checklist templates found. An admin can add them in settings.
            </div>
          )}

          {/* "I Noticed" Section */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">📝 "I Noticed" — Report an Issue</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Textarea
                placeholder="Did you find something that needs fixing? Type it here..."
                value={noticedNote}
                onChange={(e) => setNoticedNote(e.target.value)}
                rows={2}
              />
              <Button
                size="sm"
                onClick={handleSubmitNote}
                disabled={!noticedNote.trim()}
                className="gap-1"
              >
                <Send className="h-3 w-3" /> Send Note
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useProperty } from '@/hooks/useProperty';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { ArrowRight, User, CheckCircle, SprayCan, Sparkles, Eye, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

type HousekeepingStatus = 'dirty' | 'cleaning' | 'clean' | 'inspected';

interface RoomHK {
  id: string;
  room_number: string;
  room_type: string;
  housekeeping_status: HousekeepingStatus;
  cleaning_until: string | null;
  assigned_to: string | null;
  inspected_by: string | null;
  cleaning_started_at: string | null;
  cleaning_completed_at: string | null;
  property_id: string | null;
}

interface StaffMember {
  user_id: string;
  profiles: { full_name: string | null } | null;
}

const STATUS_ORDER: HousekeepingStatus[] = ['dirty', 'cleaning', 'clean', 'inspected'];

const STATUS_CONFIG: Record<HousekeepingStatus, { label: string; icon: React.ElementType; color: string; bgColor: string; borderColor: string }> = {
  dirty: { label: 'Dirty', icon: SprayCan, color: 'text-amber-700 dark:text-amber-400', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/30' },
  cleaning: { label: 'Cleaning', icon: Clock, color: 'text-orange-700 dark:text-orange-400', bgColor: 'bg-orange-500/10', borderColor: 'border-orange-500/30' },
  clean: { label: 'Clean', icon: Sparkles, color: 'text-emerald-700 dark:text-emerald-400', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/30' },
  inspected: { label: 'Inspected', icon: CheckCircle, color: 'text-blue-700 dark:text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30' },
};

function getNextStatus(current: HousekeepingStatus): HousekeepingStatus | null {
  const idx = STATUS_ORDER.indexOf(current);
  return idx < STATUS_ORDER.length - 1 ? STATUS_ORDER[idx + 1] : null;
}

function getCleaningCountdown(cleaningUntil: string | null): string | null {
  if (!cleaningUntil) return null;
  const until = new Date(cleaningUntil);
  const now = new Date();
  const diff = until.getTime() - now.getTime();
  if (diff <= 0) return 'Ready';
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return hrs > 0 ? `${hrs}h ${remainMins}m` : `${remainMins}m`;
}

export function HousekeepingBoard() {
  const { selectedProperty, showAllProperties } = useProperty();
  const { canWrite, user } = useAuth();
  const [rooms, setRooms] = useState<RoomHK[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedRoom, setDraggedRoom] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      let roomQuery = supabase
        .from('rooms')
        .select('id, room_number, room_type, housekeeping_status, cleaning_until, assigned_to, inspected_by, cleaning_started_at, cleaning_completed_at, property_id')
        .neq('status', 'maintenance')
        .order('room_number');

      if (!showAllProperties && selectedProperty?.id) {
        roomQuery = roomQuery.eq('property_id', selectedProperty.id);
      }

      const [{ data: roomData, error: roomError }, { data: staffData }] = await Promise.all([
        roomQuery,
        supabase.from('user_roles').select('user_id, profiles:profiles(full_name)').in('role', ['admin', 'manager', 'front_desk']),
      ]);

      if (roomError) throw roomError;
      setRooms((roomData as any[])?.map(r => ({ ...r, housekeeping_status: r.housekeeping_status || 'clean' })) || []);
      setStaff((staffData as any[])?.map(s => ({ ...s, profiles: Array.isArray(s.profiles) ? s.profiles[0] : s.profiles })) || []);
    } catch (error) {
      console.error('Error fetching housekeeping data:', error);
      toast.error('Failed to load housekeeping data');
    } finally {
      setLoading(false);
    }
  }, [selectedProperty, showAllProperties]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Realtime subscription for instant updates
  useEffect(() => {
    const channel = supabase
      .channel('housekeeping-rooms')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms' },
        () => fetchData()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const updateRoomHK = async (roomId: string, updates: Record<string, any>) => {
    try {
      const { error } = await supabase.from('rooms').update(updates as any).eq('id', roomId);
      if (error) throw error;
      fetchData();
    } catch (error) {
      toast.error('Failed to update room');
      throw error;
    }
  };

  const handleTransition = async (roomId: string, newStatus: HousekeepingStatus) => {
    const updates: Record<string, any> = { housekeeping_status: newStatus };

    if (newStatus === 'cleaning') {
      updates.cleaning_started_at = new Date().toISOString();
      updates.assigned_to = user?.id || null;
    } else if (newStatus === 'clean') {
      updates.cleaning_completed_at = new Date().toISOString();
      updates.cleaning_until = null;
    } else if (newStatus === 'inspected') {
      updates.inspected_by = user?.id || null;
    }

    try {
      await updateRoomHK(roomId, updates);
      toast.success(`Room moved to ${STATUS_CONFIG[newStatus].label}`);
    } catch {
      // error already handled
    }
  };

  const handleAssignStaff = async (roomId: string, staffId: string) => {
    try {
      await updateRoomHK(roomId, { assigned_to: staffId });
      toast.success('Staff assigned');
    } catch {
      // handled
    }
  };

  const handleDragStart = (e: React.DragEvent, roomId: string) => {
    setDraggedRoom(roomId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: HousekeepingStatus) => {
    e.preventDefault();
    if (!draggedRoom || !canWrite) return;

    const room = rooms.find(r => r.id === draggedRoom);
    if (!room) return;

    // Only allow forward transitions (or any for admin)
    const currentIdx = STATUS_ORDER.indexOf(room.housekeeping_status);
    const targetIdx = STATUS_ORDER.indexOf(targetStatus);

    if (targetIdx <= currentIdx) {
      toast.error('Can only move rooms forward in the housekeeping workflow');
      setDraggedRoom(null);
      return;
    }

    await handleTransition(draggedRoom, targetStatus);
    setDraggedRoom(null);
  };

  const getStaffName = (userId: string | null) => {
    if (!userId) return null;
    const s = staff.find(m => m.user_id === userId);
    return s?.profiles?.full_name || 'Staff';
  };

  const getRoomsByStatus = (status: HousekeepingStatus) =>
    rooms.filter(r => r.housekeeping_status === status);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STATUS_ORDER.map(status => {
          const config = STATUS_CONFIG[status];
          const Icon = config.icon;
          const count = getRoomsByStatus(status).length;
          return (
            <div key={status} className={cn("flex items-center gap-3 p-3 rounded-xl border", config.bgColor, config.borderColor)}>
              <Icon className={cn("h-5 w-5", config.color)} />
              <div>
                <p className={cn("text-sm font-semibold", config.color)}>{count}</p>
                <p className="text-xs text-muted-foreground">{config.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Board Columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STATUS_ORDER.map(status => {
          const config = STATUS_CONFIG[status];
          const Icon = config.icon;
          const statusRooms = getRoomsByStatus(status);
          const nextStatus = getNextStatus(status);

          return (
            <div
              key={status}
              className={cn(
                "rounded-2xl border-2 border-dashed p-3 min-h-[200px] transition-colors",
                draggedRoom ? "border-primary/40 bg-primary/5" : "border-border bg-muted/30"
              )}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, status)}
            >
              {/* Column Header */}
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/50">
                <div className={cn("p-1.5 rounded-lg", config.bgColor)}>
                  <Icon className={cn("h-4 w-4", config.color)} />
                </div>
                <span className="text-sm font-semibold">{config.label}</span>
                <Badge variant="secondary" className="ml-auto text-xs">{statusRooms.length}</Badge>
              </div>

              {/* Room Cards */}
              <div className="space-y-2">
                {statusRooms.map(room => {
                  const countdown = getCleaningCountdown(room.cleaning_until);
                  const assignedName = getStaffName(room.assigned_to);
                  const inspectedByName = getStaffName(room.inspected_by);

                  return (
                    <Card
                      key={room.id}
                      draggable={canWrite}
                      onDragStart={(e) => handleDragStart(e, room.id)}
                      className={cn(
                        "cursor-grab active:cursor-grabbing transition-all hover:shadow-md border",
                        config.borderColor,
                        !canWrite && "cursor-default"
                      )}
                    >
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm">Room {room.room_number}</span>
                          <span className="text-xs text-muted-foreground capitalize">{room.room_type}</span>
                        </div>

                        {/* Countdown */}
                        {status === 'cleaning' && countdown && (
                          <div className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
                            <Clock className="h-3 w-3" />
                            <span>{countdown}</span>
                          </div>
                        )}

                        {/* Assigned Staff */}
                        {assignedName && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <User className="h-3 w-3" />
                            <span>{assignedName}</span>
                          </div>
                        )}

                        {/* Inspected By */}
                        {status === 'inspected' && inspectedByName && (
                          <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                            <Eye className="h-3 w-3" />
                            <span>Inspected by {inspectedByName}</span>
                          </div>
                        )}

                        {/* Actions */}
                        {canWrite && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {/* Assign Staff (for dirty/cleaning) */}
                            {(status === 'dirty' || status === 'cleaning') && (
                              <Select
                                value={room.assigned_to || ''}
                                onValueChange={(val) => handleAssignStaff(room.id, val)}
                              >
                                <SelectTrigger className="h-7 text-xs flex-1 min-w-[100px]">
                                  <SelectValue placeholder="Assign" />
                                </SelectTrigger>
                                <SelectContent>
                                  {staff.map(s => (
                                    <SelectItem key={s.user_id} value={s.user_id}>
                                      {s.profiles?.full_name || 'Staff'}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}

                            {/* Next status button */}
                            {nextStatus && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1"
                                onClick={() => handleTransition(room.id, nextStatus)}
                              >
                                <ArrowRight className="h-3 w-3" />
                                {STATUS_CONFIG[nextStatus].label}
                              </Button>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}

                {statusRooms.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground text-xs">
                    No rooms
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

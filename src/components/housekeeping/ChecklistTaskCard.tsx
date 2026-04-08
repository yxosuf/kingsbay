import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ChecklistPhotoUpload } from './ChecklistPhotoUpload';
import { User, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

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
  // joined from checklist
  title: string;
  description: string | null;
  requires_photo: boolean;
}

interface StaffMember {
  user_id: string;
  full_name: string | null;
}

interface ChecklistTaskCardProps {
  task: TaskInstance;
  staff: StaffMember[];
  canWrite: boolean;
  onToggleComplete: (taskId: string, completed: boolean) => void;
  onAssign: (taskId: string, staffId: string) => void;
  onUrgencyChange: (taskId: string, level: number) => void;
  onPhotoUploaded: (taskId: string, path: string) => void;
}

const URGENCY_CONFIG: Record<number, { label: string; color: string }> = {
  1: { label: 'Routine', color: 'text-muted-foreground' },
  2: { label: 'Important', color: 'text-amber-600' },
  3: { label: 'Critical', color: 'text-red-600' },
};

export function ChecklistTaskCard({
  task, staff, canWrite, onToggleComplete, onAssign, onUrgencyChange, onPhotoUploaded
}: ChecklistTaskCardProps) {
  const isCompleted = task.status === 'completed';
  const needsPhoto = task.requires_photo && !task.photo_path && !isCompleted;
  const completedByName = task.completed_by ? staff.find(s => s.user_id === task.completed_by)?.full_name : null;

  return (
    <div className={cn(
      "flex items-start gap-3 p-3 rounded-xl border transition-all",
      isCompleted ? "bg-muted/40 border-border/50" : "bg-card border-border hover:shadow-sm"
    )}>
      {canWrite && (
        <Checkbox
          checked={isCompleted}
          disabled={task.requires_photo && !task.photo_path && !isCompleted}
          onCheckedChange={(checked) => onToggleComplete(task.id, !!checked)}
          className="mt-0.5"
        />
      )}

      <div className="flex-1 min-w-0 space-y-1.5">
        <p className={cn("text-sm font-medium", isCompleted && "line-through text-muted-foreground")}>
          {task.title}
        </p>
        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {/* Urgency */}
          {task.urgency_level > 1 && (
            <Badge variant="outline" className={cn("text-xs gap-1", URGENCY_CONFIG[task.urgency_level].color)}>
              <AlertTriangle className="h-3 w-3" />
              {URGENCY_CONFIG[task.urgency_level].label}
            </Badge>
          )}

          {/* Completed info */}
          {isCompleted && task.completed_at && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {format(new Date(task.completed_at), 'HH:mm')}
              {completedByName && ` by ${completedByName}`}
            </span>
          )}

          {/* Photo required warning */}
          {needsPhoto && (
            <span className="text-xs text-amber-600 flex items-center gap-1">
              📷 Photo required
            </span>
          )}
        </div>

        {/* Actions row */}
        {canWrite && !isCompleted && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            <Select value={task.assigned_to || ''} onValueChange={(val) => onAssign(task.id, val)}>
              <SelectTrigger className="h-7 text-xs w-[130px]">
                <SelectValue placeholder="Assign staff" />
              </SelectTrigger>
              <SelectContent>
                {staff.map(s => (
                  <SelectItem key={s.user_id} value={s.user_id}>
                    {s.full_name || 'Staff'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={String(task.urgency_level)} onValueChange={(val) => onUrgencyChange(task.id, Number(val))}>
              <SelectTrigger className="h-7 text-xs w-[110px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">🟢 Routine</SelectItem>
                <SelectItem value="2">🟡 Important</SelectItem>
                <SelectItem value="3">🔴 Critical</SelectItem>
              </SelectContent>
            </Select>

            {task.requires_photo && (
              <ChecklistPhotoUpload
                taskInstanceId={task.id}
                existingPhotoPath={task.photo_path}
                onUploaded={(path) => onPhotoUploaded(task.id, path)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

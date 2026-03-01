import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock } from 'lucide-react';

const statusConfig: Record<string, { className: string; label: string }> = {
  pending: { className: 'bg-warning/20 text-warning-foreground border-warning', label: 'Pending' },
  confirmed: { className: 'bg-info/20 text-info border-info', label: 'Confirmed' },
  checked_in: { className: 'bg-success/20 text-success border-success', label: 'Checked In' },
  checked_out: { className: 'bg-muted text-muted-foreground', label: 'Checked Out' },
  cancelled: { className: 'bg-destructive/20 text-destructive border-destructive', label: 'Cancelled' },
  no_show: { className: 'bg-destructive/20 text-destructive border-destructive', label: 'No Show' },
  needs_review: { className: 'bg-warning/20 text-warning-foreground border-warning', label: 'Needs Review' },
};

interface BookingStatusBadgeProps {
  status: string;
  needsReview?: boolean | null;
  className?: string;
}

export function BookingStatusBadge({ status, needsReview, className }: BookingStatusBadgeProps) {
  const config = statusConfig[status] || { className: '', label: status.replace('_', ' ') };

  return (
    <div className={`flex items-center gap-1.5 ${className || ''}`}>
      <Badge variant="outline" className={config.className}>
        {status === 'needs_review' && <AlertTriangle className="h-3 w-3 mr-1" />}
        {config.label}
      </Badge>
      {needsReview && status !== 'needs_review' && (
        <Badge variant="destructive" className="flex items-center gap-1 text-xs">
          <AlertTriangle className="h-3 w-3" />
          Review
        </Badge>
      )}
    </div>
  );
}

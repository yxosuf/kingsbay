import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock } from 'lucide-react';
import { getBookingStatusConfig } from '@/lib/bookingStatus';

interface BookingStatusBadgeProps {
  status: string;
  needsReview?: boolean | null;
  className?: string;
}

export function BookingStatusBadge({ status, needsReview, className }: BookingStatusBadgeProps) {
  const config = getBookingStatusConfig(status);

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

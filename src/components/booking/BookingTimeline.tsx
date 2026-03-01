import { format } from 'date-fns';
import { CheckCircle, Clock, XCircle, LogIn, LogOut, UserX, AlertTriangle } from 'lucide-react';

interface TimelineEvent {
  label: string;
  timestamp: string | null;
  icon: React.ReactNode;
  active: boolean;
}

interface BookingTimelineProps {
  booking: {
    status: string;
    created_at: string;
    check_in: string;
    check_out: string;
    checked_in_at?: string | null;
    checked_out_at?: string | null;
    cancelled_at?: string | null;
    no_show_at?: string | null;
    cancel_reason?: string | null;
  };
}

export function BookingTimeline({ booking }: BookingTimelineProps) {
  const events: TimelineEvent[] = [
    {
      label: 'Booking Created',
      timestamp: booking.created_at,
      icon: <Clock className="h-4 w-4" />,
      active: true,
    },
    {
      label: 'Check-in',
      timestamp: booking.checked_in_at || null,
      icon: <LogIn className="h-4 w-4" />,
      active: !!booking.checked_in_at,
    },
  ];

  if (booking.status === 'checked_out' || booking.checked_out_at) {
    events.push({
      label: 'Check-out',
      timestamp: booking.checked_out_at || null,
      icon: <LogOut className="h-4 w-4" />,
      active: !!booking.checked_out_at,
    });
  }

  if (booking.status === 'cancelled') {
    events.push({
      label: `Cancelled${booking.cancel_reason ? `: ${booking.cancel_reason}` : ''}`,
      timestamp: booking.cancelled_at || null,
      icon: <XCircle className="h-4 w-4" />,
      active: true,
    });
  }

  if (booking.status === 'no_show') {
    events.push({
      label: 'Marked as No-Show',
      timestamp: booking.no_show_at || null,
      icon: <UserX className="h-4 w-4" />,
      active: true,
    });
  }

  if (booking.status === 'needs_review') {
    events.push({
      label: 'Awaiting Review',
      timestamp: null,
      icon: <AlertTriangle className="h-4 w-4" />,
      active: true,
    });
  }

  return (
    <div className="space-y-0">
      {events.map((event, index) => (
        <div key={index} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                event.active
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-muted bg-muted text-muted-foreground'
              }`}
            >
              {event.icon}
            </div>
            {index < events.length - 1 && (
              <div className={`w-0.5 h-8 ${event.active ? 'bg-primary/30' : 'bg-muted'}`} />
            )}
          </div>
          <div className="pb-6">
            <p className={`text-sm font-medium ${event.active ? 'text-foreground' : 'text-muted-foreground'}`}>
              {event.label}
            </p>
            {event.timestamp && (
              <p className="text-xs text-muted-foreground">
                {format(new Date(event.timestamp), 'PPp')}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

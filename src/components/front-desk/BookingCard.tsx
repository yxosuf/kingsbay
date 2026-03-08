import { Badge } from '@/components/ui/badge';
import { BookingQuickActions } from '@/components/booking/BookingQuickActions';

interface FrontDeskBooking {
  id: string;
  check_in: string;
  check_out: string;
  status: string;
  num_guests: number | null;
  total_amount: number | null;
  room_id: string;
  property_id: string | null;
  booking_source: string;
  guests: { name: string; phone: string | null } | null;
  rooms: { room_number: string; room_type: string } | null;
}

interface BookingCardProps {
  booking: FrontDeskBooking;
  onActionComplete: () => void;
  badge?: React.ReactNode;
}

export function BookingCard({ booking, onActionComplete, badge }: BookingCardProps) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border p-3 hover:bg-muted/30 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">
              {booking.guests?.name || 'Unknown Guest'}
            </p>
            {badge}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Room {booking.rooms?.room_number || '—'} · {booking.rooms?.room_type || ''}
            {booking.num_guests
              ? ` · ${booking.num_guests} guest${booking.num_guests > 1 ? 's' : ''}`
              : ''}
          </p>
          {booking.guests?.phone && (
            <p className="text-xs text-muted-foreground">{booking.guests.phone}</p>
          )}
        </div>
        {booking.total_amount != null && (
          <p className="text-xs font-medium shrink-0">
            LKR {Number(booking.total_amount).toLocaleString()}
          </p>
        )}
      </div>
      <BookingQuickActions booking={booking} onActionComplete={onActionComplete} compact />
    </div>
  );
}

export type { FrontDeskBooking };

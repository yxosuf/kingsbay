import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BookingStatusBadge } from './BookingStatusBadge';
import { BookingQuickActions } from './BookingQuickActions';
import { useIsMobile } from '@/hooks/use-mobile';
import { BookOpen, Clock } from 'lucide-react';
import { parseLocalDate } from '@/lib/dateUtils';

export interface BookingRow {
  id: string;
  check_in: string;
  check_out: string;
  status: string;
  num_guests: number;
  total_amount: number;
  room_id: string;
  property_id: string | null;
  booking_source: string;
  needs_review: boolean;
  review_reason: string | null;
  hold_expires_at?: string | null;
  guests: { name: string; phone: string } | null;
  rooms: { room_number: string; room_type: string } | null;
}

function HoldCountdown({ expiresAt }: { expiresAt: string }) {
  const expiry = new Date(expiresAt);
  const now = new Date();
  const diffMs = expiry.getTime() - now.getTime();
  
  if (diffMs <= 0) {
    return (
      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive text-xs">
        Expired – requires manual review
      </Badge>
    );
  }
  
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  return (
    <Badge variant="outline" className="bg-orange-500/10 text-orange-700 border-orange-500 text-xs gap-1">
      <Clock className="h-3 w-3" />
      {hours}h {mins}m remaining
    </Badge>
  );
}

interface BookingTableProps {
  bookings: BookingRow[];
  loading: boolean;
  onActionComplete: () => void;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleOne?: (id: string) => void;
  onToggleAll?: () => void;
  isAllSelected?: boolean;
  isSomeSelected?: boolean;
}

export const BookingTable = memo(function BookingTable({
  bookings, loading, onActionComplete,
  selectable, selectedIds, onToggleOne, onToggleAll, isAllSelected, isSomeSelected,
}: BookingTableProps) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No bookings found.</p>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="space-y-3">
        {bookings.map((booking) => (
          <Card key={booking.id} className="border-border/50">
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{booking.guests?.name || 'Unknown'}</p>
                  <p className="text-sm text-muted-foreground">{booking.guests?.phone}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <BookingStatusBadge status={booking.status} needsReview={booking.needs_review} />
                  {booking.status === 'needs_review' && booking.hold_expires_at && (
                    <HoldCountdown expiresAt={booking.hold_expires_at} />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Room</p>
                  <p className="font-medium">
                    {booking.rooms?.room_number || 'N/A'}
                    <span className="text-muted-foreground capitalize"> · {booking.rooms?.room_type}</span>
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Amount</p>
                  <p className="font-medium">Rs. {booking.total_amount?.toLocaleString() || '0'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Check-in</p>
                  <p className="font-medium">{new Date(booking.check_in).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Check-out</p>
                  <p className="font-medium">{new Date(booking.check_out).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="pt-2 border-t">
                <BookingQuickActions booking={booking} onActionComplete={onActionComplete} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {selectable && (
            <TableHead className="w-10">
              <Checkbox
                checked={isAllSelected}
                onCheckedChange={() => onToggleAll?.()}
                aria-label="Select all"
                {...(isSomeSelected ? { 'data-state': 'indeterminate' } : {})}
              />
            </TableHead>
          )}
          <TableHead>Guest</TableHead>
          <TableHead>Room</TableHead>
          <TableHead>Check-in</TableHead>
          <TableHead>Check-out</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Guests</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {bookings.map((booking) => (
          <TableRow key={booking.id} className="cursor-pointer" onClick={() => navigate(`/bookings/${booking.id}`)}>
            <TableCell>
              <div>
                <p className="font-medium">{booking.guests?.name || 'Unknown'}</p>
                <p className="text-sm text-muted-foreground">{booking.guests?.phone}</p>
              </div>
            </TableCell>
            <TableCell>
              <div>
                <p>Room {booking.rooms?.room_number || 'N/A'}</p>
                <p className="text-sm text-muted-foreground capitalize">{booking.rooms?.room_type}</p>
              </div>
            </TableCell>
            <TableCell>{parseLocalDate(booking.check_in).toLocaleDateString()}</TableCell>
            <TableCell>{parseLocalDate(booking.check_out).toLocaleDateString()}</TableCell>
            <TableCell>
              <div className="flex flex-col gap-1">
                <BookingStatusBadge status={booking.status} needsReview={booking.needs_review} />
                {booking.status === 'needs_review' && booking.hold_expires_at && (
                  <HoldCountdown expiresAt={booking.hold_expires_at} />
                )}
              </div>
            </TableCell>
            <TableCell>
              {(booking as any).num_adults && (booking as any).num_children !== undefined
                ? `${(booking as any).num_adults}A + ${(booking as any).num_children}C`
                : `${booking.num_guests} guest${booking.num_guests !== 1 ? 's' : ''}`}
            </TableCell>
            <TableCell>Rs. {booking.total_amount?.toLocaleString() || '0'}</TableCell>
            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
              <BookingQuickActions booking={booking} onActionComplete={onActionComplete} compact />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
});

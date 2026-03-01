import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
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
import { BookOpen } from 'lucide-react';

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
  guests: { name: string; phone: string } | null;
  rooms: { room_number: string; room_type: string } | null;
}

interface BookingTableProps {
  bookings: BookingRow[];
  loading: boolean;
  onActionComplete: () => void;
}

export function BookingTable({ bookings, loading, onActionComplete }: BookingTableProps) {
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
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{booking.guests?.name || 'Unknown'}</p>
                  <p className="text-sm text-muted-foreground">{booking.guests?.phone}</p>
                </div>
                <BookingStatusBadge status={booking.status} needsReview={booking.needs_review} />
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
          <TableHead>Guest</TableHead>
          <TableHead>Room</TableHead>
          <TableHead>Check-in</TableHead>
          <TableHead>Check-out</TableHead>
          <TableHead>Status</TableHead>
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
            <TableCell>{new Date(booking.check_in).toLocaleDateString()}</TableCell>
            <TableCell>{new Date(booking.check_out).toLocaleDateString()}</TableCell>
            <TableCell>
              <BookingStatusBadge status={booking.status} needsReview={booking.needs_review} />
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
}

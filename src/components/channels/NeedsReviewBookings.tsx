import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertTriangle,
  Check,
  RefreshCw,
  Calendar,
  User,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useProperty } from '@/hooks/useProperty';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Booking {
  id: string;
  check_in: string;
  check_out: string;
  status: string;
  booking_source: string;
  external_booking_id: string | null;
  external_room_type_id: string | null;
  needs_review: boolean;
  review_reason: string | null;
  room_id: string;
  guest: {
    name: string;
  };
  room: {
    room_number: string;
    room_type: string;
  };
}

interface Room {
  id: string;
  room_number: string;
  room_type: string;
}

export function NeedsReviewBookings() {
  const { selectedProperty } = useProperty();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [resolving, setResolving] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    bookingId: string;
    newRoomId: string;
    action: 'reassign' | 'approve';
  } | null>(null);

  useEffect(() => {
    if (selectedProperty?.id) {
      fetchData();
    }
  }, [selectedProperty?.id]);

  const fetchData = async () => {
    if (!selectedProperty?.id) return;
    setLoading(true);

    try {
      // Fetch bookings that need review
      const { data: bookingData, error } = await supabase
        .from('bookings')
        .select(`
          id, check_in, check_out, status, booking_source,
          external_booking_id, external_room_type_id,
          needs_review, review_reason, room_id,
          guest:guests(name),
          room:rooms(room_number, room_type)
        `)
        .eq('property_id', selectedProperty.id)
        .eq('needs_review', true)
        .order('check_in', { ascending: true });

      if (error) throw error;
      setBookings((bookingData as any) || []);

      // Fetch rooms
      const { data: roomData } = await supabase
        .from('rooms')
        .select('id, room_number, room_type')
        .eq('property_id', selectedProperty.id)
        .eq('status', 'available')
        .order('room_number');

      setRooms(roomData || []);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  const handleReassign = async (bookingId: string, newRoomId: string) => {
    setConfirmDialog({
      open: true,
      bookingId,
      newRoomId,
      action: 'reassign',
    });
  };

  const handleApprove = async (bookingId: string) => {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return;
    
    setConfirmDialog({
      open: true,
      bookingId,
      newRoomId: booking.room_id,
      action: 'approve',
    });
  };

  const executeAction = async () => {
    if (!confirmDialog) return;

    const { bookingId, newRoomId, action } = confirmDialog;
    setResolving(bookingId);

    try {
      const updateData: any = {
        needs_review: false,
        review_reason: null,
      };

      if (action === 'reassign') {
        updateData.room_id = newRoomId;
      }

      const { error } = await supabase
        .from('bookings')
        .update(updateData)
        .eq('id', bookingId);

      if (error) throw error;

      toast.success(
        action === 'reassign' 
          ? 'Booking reassigned and approved'
          : 'Booking approved'
      );
      fetchData();
    } catch (error: any) {
      console.error('Error updating booking:', error);
      toast.error(error.message || 'Failed to update booking');
    } finally {
      setResolving(null);
      setConfirmDialog(null);
    }
  };

  const getSourceBadge = (source: string) => {
    const names: Record<string, string> = {
      booking_com: 'Booking.com',
      airbnb: 'Airbnb',
      agoda: 'Agoda',
      expedia: 'Expedia',
      other_ota: 'Other OTA',
      direct: 'Direct',
    };

    return (
      <Badge variant="secondary">
        {names[source] || source}
      </Badge>
    );
  };

  if (!selectedProperty) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Please select a property first</p>
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Bookings Needing Review
              </CardTitle>
              <CardDescription>
                OTA bookings that require manual verification or room assignment
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {bookings.length > 0 && (
                <Badge variant="destructive">
                  {bookings.length} Pending
                </Badge>
              )}
              <Button variant="outline" size="sm" onClick={fetchData}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : bookings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Check className="h-12 w-12 mx-auto mb-4 text-primary" />
              <p className="font-medium text-foreground">All clear!</p>
              <p className="text-sm mt-1">
                No bookings need review at this time.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Guest</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Current Room</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((booking) => (
                  <TableRow key={booking.id}>
                    <TableCell>
                      {getSourceBadge(booking.booking_source)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {booking.guest?.name || 'Unknown'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {format(new Date(booking.check_in), 'MMM d')} -{' '}
                          {format(new Date(booking.check_out), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {booking.room?.room_number} ({booking.room?.room_type})
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[200px]">
                        <p className="text-sm text-destructive font-medium truncate">
                          {booking.review_reason || 'Needs verification'}
                        </p>
                        {booking.external_room_type_id && (
                          <p className="text-xs text-muted-foreground">
                            OTA Room: {booking.external_room_type_id}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Select
                          onValueChange={(value) => handleReassign(booking.id, value)}
                          disabled={resolving === booking.id}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Reassign..." />
                          </SelectTrigger>
                          <SelectContent>
                            {rooms.map((room) => (
                              <SelectItem key={room.id} value={room.id}>
                                {room.room_number}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleApprove(booking.id)}
                          disabled={resolving === booking.id}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={confirmDialog?.open || false}
        onOpenChange={(open) => !open && setConfirmDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmDialog?.action === 'reassign' 
                ? 'Confirm Room Reassignment'
                : 'Confirm Booking Approval'}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog?.action === 'reassign'
                ? 'This will assign the booking to the selected room and mark it as reviewed.'
                : 'This will mark the booking as reviewed and keep the current room assignment.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>
              Cancel
            </Button>
            <Button onClick={executeAction} disabled={resolving !== null}>
              {resolving ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

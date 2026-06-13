import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CalendarIcon, AlertTriangle, ArrowRight } from 'lucide-react';
import { format, differenceInDays, addDays, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { checkRoomAvailability } from '@/lib/availabilityCheck';
import { toast } from 'sonner';

interface Room {
  id: string;
  room_number: string;
  room_type: string;
  price: number;
}

interface ExtendStayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: {
    id: string;
    check_in: string;
    check_out: string;
    room_id: string;
    guest_id: string;
    total_amount: number;
    rooms: { id: string; room_number: string; room_type: string; price: number } | null;
  };
  onSuccess: () => void;
}

export function ExtendStayDialog({
  open,
  onOpenChange,
  booking,
  onSuccess,
}: ExtendStayDialogProps) {
  const [newCheckout, setNewCheckout] = useState<Date | undefined>(
    addDays(parseISO(booking.check_out), 1)
  );
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [availabilityResult, setAvailabilityResult] = useState<{
    isAvailable: boolean;
    conflictingBookings: { checkIn: string; checkOut: string; guestName: string }[];
  } | null>(null);
  const [showRoomMove, setShowRoomMove] = useState(false);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [selectedAlternateRoom, setSelectedAlternateRoom] = useState<string>('');
  const [splitDate, setSplitDate] = useState<Date | undefined>();

  const currentCheckout = parseISO(booking.check_out);
  const originalNights = differenceInDays(currentCheckout, parseISO(booking.check_in));
  const newNights = newCheckout
    ? differenceInDays(newCheckout, parseISO(booking.check_in))
    : originalNights;
  const additionalNights = newNights - originalNights;

  useEffect(() => {
    if (open && newCheckout && newCheckout > currentCheckout) {
      checkAvailability();
    }
  }, [newCheckout, open]);

  const checkAvailability = async () => {
    if (!newCheckout || !booking.rooms) return;

    setChecking(true);
    setAvailabilityResult(null);
    setShowRoomMove(false);

    try {
      const result = await checkRoomAvailability(
        booking.rooms.id,
        currentCheckout,
        newCheckout,
        booking.id
      );

      setAvailabilityResult({
        isAvailable: result.isAvailable,
        conflictingBookings: result.conflictingBookings,
      });

      if (!result.isAvailable) {
        // Fetch available rooms for room move
        await fetchAvailableRooms();
      }
    } catch (error) {
      console.error('Error checking availability:', error);
      toast.error('Failed to check availability');
    } finally {
      setChecking(false);
    }
  };

  const fetchAvailableRooms = async () => {
    if (!newCheckout) return;

    try {
      // Get all rooms
      const { data: allRooms } = await supabase
        .from('rooms')
        .select('id, room_number, room_type, price')
        .eq('status', 'available')
        .order('room_type');

      if (!allRooms) return;

      // Check each room's availability for the extension period
      const available: Room[] = [];
      for (const room of allRooms) {
        if (room.id === booking.rooms?.id) continue; // Skip current room

        const result = await checkRoomAvailability(
          room.id,
          currentCheckout,
          newCheckout
        );

        if (result.isAvailable) {
          available.push(room);
        }
      }

      setAvailableRooms(available);
    } catch (error) {
      console.error('Error fetching available rooms:', error);
      toast.error('Failed to load available rooms');
    }
  };

  const handleExtendStay = async () => {
    if (!newCheckout || !booking.rooms) return;

    setSaving(true);
    try {
      const additionalAmount = additionalNights * booking.rooms.price;
      const newTotalAmount = booking.total_amount + additionalAmount;

      const { error } = await supabase
        .from('bookings')
        .update({
          check_out: format(newCheckout, 'yyyy-MM-dd'),
          total_amount: newTotalAmount,
        })
        .eq('id', booking.id);

      if (error) throw error;

      toast.success(`Stay extended by ${additionalNights} night(s)`);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error extending stay:', error);
      toast.error(error.message || 'Failed to extend stay');
    } finally {
      setSaving(false);
    }
  };

  const handleRoomMove = async () => {
    if (!newCheckout || !selectedAlternateRoom || !splitDate) {
      toast.error('Please select a room and split date');
      return;
    }

    setSaving(true);
    try {
      const alternateRoom = availableRooms.find((r) => r.id === selectedAlternateRoom);
      if (!alternateRoom) throw new Error('Room not found');

      // Calculate the number of nights in the new room
      const moveNights = differenceInDays(newCheckout, splitDate);
      const moveAmount = moveNights * alternateRoom.price;

      // Create continuation booking
      const { error } = await supabase.from('bookings').insert({
        guest_id: booking.guest_id,
        room_id: selectedAlternateRoom,
        check_in: format(splitDate, 'yyyy-MM-dd'),
        check_out: format(newCheckout, 'yyyy-MM-dd'),
        status: 'confirmed',
        total_amount: moveAmount,
        special_requests: `Room move continuation from Room ${booking.rooms?.room_number}`,
        parent_booking_id: booking.id,
        booking_source: 'direct',
      });

      if (error) throw error;

      toast.success(
        `Stay extended with room move to ${alternateRoom.room_number} starting ${format(splitDate, 'PP')}`
      );
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error creating room move booking:', error);
      toast.error(error.message || 'Failed to create room move');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Extend Stay</DialogTitle>
          <DialogDescription>
            Extend the checkout date for Room {booking.rooms?.room_number}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current booking info */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Current Check-out</p>
              <p className="font-medium">{format(currentCheckout, 'PPP')}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Current Nights</p>
              <p className="font-medium">{originalNights}</p>
            </div>
          </div>

          {/* New checkout date selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">New Check-out Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {newCheckout ? format(newCheckout, 'PPP') : 'Select new date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={newCheckout}
                  onSelect={setNewCheckout}
                  disabled={(date) => date <= currentCheckout}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Availability result */}
          {checking && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Checking availability...
            </div>
          )}

          {availabilityResult && (
            <>
              {availabilityResult.isAvailable ? (
                <Alert className="border-success bg-success/10">
                  <AlertTitle className="text-success">Room Available</AlertTitle>
                  <AlertDescription>
                    Room {booking.rooms?.room_number} is available for {additionalNights} additional
                    night(s).
                    <br />
                    <span className="font-medium">
                      Additional charge: Rs.{' '}
                      {((booking.rooms?.price || 0) * additionalNights).toLocaleString()}
                    </span>
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Room Not Available</AlertTitle>
                  <AlertDescription>
                    Room {booking.rooms?.room_number} has a conflict:
                    {availabilityResult.conflictingBookings.map((c, i) => (
                      <p key={i} className="text-sm mt-1">
                        Booked by {c.guestName} from {format(parseISO(c.checkIn), 'PP')} to{' '}
                        {format(parseISO(c.checkOut), 'PP')}
                      </p>
                    ))}
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}

          {/* Room Move Option */}
          {availabilityResult && !availabilityResult.isAvailable && (
            <div className="space-y-4">
              <Button
                variant="outline"
                onClick={() => setShowRoomMove(!showRoomMove)}
                className="w-full"
              >
                <ArrowRight className="mr-2 h-4 w-4" />
                {showRoomMove ? 'Hide Room Move Options' : 'Show Room Move Options'}
              </Button>

              {showRoomMove && (
                <div className="space-y-4 p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    Create a split booking by moving the guest to a different room for the remaining
                    nights.
                  </p>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Room Move Date (Stay in current room until)</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {splitDate ? format(splitDate, 'PPP') : 'Select date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={splitDate}
                          onSelect={setSplitDate}
                          disabled={(date) =>
                            date <= currentCheckout || (newCheckout ? date >= newCheckout : false)
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Move to Room</label>
                    <Select value={selectedAlternateRoom} onValueChange={setSelectedAlternateRoom}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an available room" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableRooms.length === 0 ? (
                          <SelectItem value="none" disabled>
                            No rooms available
                          </SelectItem>
                        ) : (
                          availableRooms.map((room) => (
                            <SelectItem key={room.id} value={room.id}>
                              Room {room.room_number} ({room.room_type}) - Rs.{' '}
                              {room.price.toLocaleString()}/night
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedAlternateRoom && splitDate && newCheckout && (
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm font-medium">New Booking Summary</p>
                      <p className="text-sm text-muted-foreground">
                        Room{' '}
                        {availableRooms.find((r) => r.id === selectedAlternateRoom)?.room_number}:{' '}
                        {format(splitDate, 'PP')} to {format(newCheckout, 'PP')} (
                        {differenceInDays(newCheckout, splitDate)} nights)
                      </p>
                      <p className="text-sm font-medium mt-1">
                        Amount: Rs.{' '}
                        {(
                          (availableRooms.find((r) => r.id === selectedAlternateRoom)?.price || 0) *
                          differenceInDays(newCheckout, splitDate)
                        ).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {availabilityResult?.isAvailable ? (
            <Button onClick={handleExtendStay} disabled={saving || additionalNights <= 0}>
              {saving ? 'Extending...' : `Extend by ${additionalNights} Night(s)`}
            </Button>
          ) : showRoomMove && selectedAlternateRoom && splitDate ? (
            <Button onClick={handleRoomMove} disabled={saving}>
              {saving ? 'Creating...' : 'Create Room Move Booking'}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

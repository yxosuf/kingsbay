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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Room {
  id: string;
  room_number: string;
  room_type: string;
  price: number;
  property_id: string | null;
}

interface MoveRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: {
    id: string;
    room_id: string;
    property_id: string | null;
    rooms: { room_number: string; room_type: string } | null;
    guests: { name: string } | null;
  };
  onSuccess: () => void;
}

export function MoveRoomDialog({ open, onOpenChange, booking, onSuccess }: MoveRoomDialogProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      fetchAvailableRooms();
      setSelectedRoom('');
    }
  }, [open]);

  const fetchAvailableRooms = async () => {
    setLoading(true);
    try {
      let q = supabase
        .from('rooms')
        .select('id, room_number, room_type, price, property_id')
        .eq('status', 'available')
        .neq('id', booking.room_id)
        .order('room_number');

      if (booking.property_id) {
        q = q.eq('property_id', booking.property_id);
      }

      const { data, error } = await q;
      if (error) throw error;
      setRooms(data || []);
    } catch {
      toast.error('Failed to load available rooms');
    } finally {
      setLoading(false);
    }
  };

  const handleMove = async () => {
    if (!selectedRoom) return;
    setSaving(true);
    try {
      // Update booking room
      const { error: bookingErr } = await supabase
        .from('bookings')
        .update({ room_id: selectedRoom })
        .eq('id', booking.id);
      if (bookingErr) throw bookingErr;

      // Free old room
      await supabase
        .from('rooms')
        .update({ status: 'available' })
        .eq('id', booking.room_id);

      // Occupy new room
      await supabase
        .from('rooms')
        .update({ status: 'occupied' })
        .eq('id', selectedRoom);

      const newRoom = rooms.find((r) => r.id === selectedRoom);
      toast.success(`Guest moved to Room ${newRoom?.room_number}`);
      onSuccess();
      onOpenChange(false);
    } catch {
      toast.error('Failed to move room. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Move Room</DialogTitle>
          <DialogDescription>
            Move {booking.guests?.name || 'guest'} from Room {booking.rooms?.room_number} to a new room.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
            <p><span className="text-muted-foreground">Guest:</span> {booking.guests?.name || 'Unknown'}</p>
            <p><span className="text-muted-foreground">Current Room:</span> {booking.rooms?.room_number} ({booking.rooms?.room_type})</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Move to Room</label>
            {loading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <Select value={selectedRoom} onValueChange={setSelectedRoom}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an available room" />
                </SelectTrigger>
                <SelectContent>
                  {rooms.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No rooms available
                    </SelectItem>
                  ) : (
                    rooms.map((room) => (
                      <SelectItem key={room.id} value={room.id}>
                        Room {room.room_number} · {room.room_type} · LKR {room.price.toLocaleString()}/night
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleMove} disabled={saving || !selectedRoom}>
            {saving ? 'Moving...' : 'Confirm Move'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

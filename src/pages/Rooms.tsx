import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Edit, Trash2, BedDouble, Wrench, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProperty } from '@/hooks/useProperty';
import { toast } from 'sonner';
import { getSafeErrorMessage, logError } from '@/lib/errorHandling';
import { toDateString } from '@/lib/dateUtils';

type RoomStatus = 'available' | 'occupied' | 'reserved' | 'maintenance';
type DerivedStatus = 'occupied' | 'due_out' | 'arriving' | 'cleaning' | 'dirty' | 'maintenance' | 'available';

interface Room {
  id: string;
  room_number: string;
  room_type: string;
  price: number;
  status: RoomStatus;
  max_guests: number;
  floor: number | null;
  description: string | null;
  amenities: string[] | null;
  property_id: string | null;
  housekeeping_status: string;
  cleaning_until: string | null;
}

interface RoomBooking {
  room_id: string;
  check_in: string;
  check_out: string;
  status: string;
  guests: { name: string } | null;
}

const roomTypes = ['standard', 'double', 'deluxe', 'suite', 'family', 'penthouse', 'apartment'];

const derivedStatusConfig: Record<DerivedStatus, { label: string; color: string }> = {
  occupied: { label: 'Occupied', color: 'bg-destructive/20 text-destructive border-destructive' },
  due_out: { label: 'Due Out Today', color: 'bg-warning/20 text-warning-foreground border-warning' },
  arriving: { label: 'Arriving Today', color: 'bg-info/20 text-info border-info' },
  cleaning: { label: 'Cleaning', color: 'bg-orange-500/20 text-orange-700 border-orange-500' },
  dirty: { label: 'Dirty', color: 'bg-amber-500/20 text-amber-700 border-amber-500' },
  maintenance: { label: 'Maintenance', color: 'bg-muted text-muted-foreground border-muted-foreground' },
  available: { label: 'Available', color: 'bg-success/20 text-success border-success' },
};

export default function Rooms() {
  const { isAdmin, canWrite } = useAuth();
  const { selectedProperty, showAllProperties } = useProperty();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<RoomBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [roomNumber, setRoomNumber] = useState('');
  const [roomType, setRoomType] = useState('standard');
  const [price, setPrice] = useState('');
  const [maxGuests, setMaxGuests] = useState('2');
  const [floor, setFloor] = useState('');
  const [description, setDescription] = useState('');

  const today = toDateString(new Date());

  useEffect(() => {
    fetchRooms();
  }, [selectedProperty, showAllProperties]);

  const fetchRooms = async () => {
    try {
      let roomQuery = supabase
        .from('rooms')
        .select('*')
        .order('room_number');
      
      if (!showAllProperties && selectedProperty?.id) {
        roomQuery = roomQuery.eq('property_id', selectedProperty.id);
      }

      const { data: roomData, error: roomError } = await roomQuery;
      if (roomError) throw roomError;
      setRooms((roomData as Room[]) || []);

      // Fetch today's active bookings for derived status
      let bookingQuery = supabase
        .from('bookings')
        .select('room_id, check_in, check_out, status, guests(name)')
        .in('status', ['confirmed', 'checked_in', 'pending', 'needs_review'])
        .lte('check_in', today)
        .gt('check_out', today);

      if (!showAllProperties && selectedProperty?.id) {
        bookingQuery = bookingQuery.eq('property_id', selectedProperty.id);
      }

      // Also fetch arriving today (check_in = today, not yet in range query above for future check_in)
      let arrivingQuery = supabase
        .from('bookings')
        .select('room_id, check_in, check_out, status, guests(name)')
        .eq('check_in', today)
        .in('status', ['confirmed', 'pending']);

      if (!showAllProperties && selectedProperty?.id) {
        arrivingQuery = arrivingQuery.eq('property_id', selectedProperty.id);
      }

      // Fetch departing today
      let departingQuery = supabase
        .from('bookings')
        .select('room_id, check_in, check_out, status, guests(name)')
        .eq('check_out', today)
        .eq('status', 'checked_in');

      if (!showAllProperties && selectedProperty?.id) {
        departingQuery = departingQuery.eq('property_id', selectedProperty.id);
      }

      const [{ data: activeData }, { data: arrivingData }, { data: departingData }] = await Promise.all([
        bookingQuery, arrivingQuery, departingQuery
      ]);

      const allBookings = [
        ...(activeData || []),
        ...(arrivingData || []),
        ...(departingData || []),
      ].map(b => ({
        ...b,
        guests: Array.isArray(b.guests) ? b.guests[0] : b.guests
      }));

      // Deduplicate by room_id + status
      const seen = new Set<string>();
      const deduped = allBookings.filter(b => {
        const key = `${b.room_id}-${b.check_in}-${b.status}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setBookings(deduped as RoomBooking[]);
    } catch (error) {
      console.error('Error fetching rooms:', error);
      toast.error('Failed to load rooms');
    } finally {
      setLoading(false);
    }
  };

  const getDerivedStatus = (room: Room): { status: DerivedStatus; guestName?: string } => {
    // Maintenance takes priority
    if (room.status === 'maintenance') {
      return { status: 'maintenance' };
    }

    // Check for due out today (checked_in + check_out == today)
    const departingBooking = bookings.find(
      b => b.room_id === room.id && b.status === 'checked_in' && b.check_out === today
    );
    if (departingBooking) {
      return { status: 'due_out', guestName: departingBooking.guests?.name };
    }

    // Check for occupied (checked_in and today < check_out)
    const occupiedBooking = bookings.find(
      b => b.room_id === room.id && b.status === 'checked_in' && b.check_out > today
    );
    if (occupiedBooking) {
      return { status: 'occupied', guestName: occupiedBooking.guests?.name };
    }

    // Check for arriving today
    const arrivingBooking = bookings.find(
      b => b.room_id === room.id && b.check_in === today && (b.status === 'confirmed' || b.status === 'pending')
    );
    if (arrivingBooking) {
      return { status: 'arriving', guestName: arrivingBooking.guests?.name };
    }

    // Housekeeping status
    if (room.housekeeping_status === 'cleaning') {
      return { status: 'cleaning' };
    }
    if (room.housekeeping_status === 'dirty') {
      return { status: 'dirty' };
    }

    return { status: 'available' };
  };

  const getCleaningCountdown = (room: Room): string | null => {
    if (room.housekeeping_status !== 'cleaning' || !room.cleaning_until) return null;
    const until = new Date(room.cleaning_until);
    const now = new Date();
    const diff = until.getTime() - now.getTime();
    if (diff <= 0) return 'Ready';
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    const remainMins = mins % 60;
    return hrs > 0 ? `${hrs}h ${remainMins}m left` : `${remainMins}m left`;
  };

  const handleMarkClean = async (roomId: string) => {
    try {
      const { error } = await supabase
        .from('rooms')
        .update({ housekeeping_status: 'clean', cleaning_until: null } as any)
        .eq('id', roomId);
      if (error) throw error;
      toast.success('Room marked as clean');
      fetchRooms();
    } catch (error) {
      toast.error('Failed to update housekeeping status');
    }
  };

  const resetForm = () => {
    setRoomNumber('');
    setRoomType('standard');
    setPrice('');
    setMaxGuests('2');
    setFloor('');
    setDescription('');
    setEditingRoom(null);
  };

  const openEditDialog = (room: Room) => {
    setEditingRoom(room);
    setRoomNumber(room.room_number);
    setRoomType(room.room_type);
    setPrice(room.price.toString());
    setMaxGuests(room.max_guests?.toString() || '2');
    setFloor(room.floor?.toString() || '');
    setDescription(room.description || '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!roomNumber.trim() || !price) {
      toast.error('Please fill in required fields');
      return;
    }

    setSaving(true);
    try {
      const roomData = {
        room_number: roomNumber.trim(),
        room_type: roomType,
        price: parseFloat(price),
        max_guests: parseInt(maxGuests),
        floor: floor ? parseInt(floor) : null,
        description: description.trim() || null,
        property_id: selectedProperty?.id || null,
      };

      if (editingRoom) {
        const { error } = await supabase
          .from('rooms')
          .update(roomData)
          .eq('id', editingRoom.id);
        if (error) throw error;
        toast.success('Room updated successfully');
      } else {
        if (!selectedProperty?.id) {
          toast.error('Please select a property first');
          return;
        }
        const { error } = await supabase.from('rooms').insert(roomData);
        if (error) throw error;
        toast.success('Room added successfully');
      }

      setDialogOpen(false);
      resetForm();
      fetchRooms();
    } catch (error: any) {
      logError('Error saving room', error);
      toast.error(getSafeErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (roomId: string) => {
    if (!confirm('Are you sure you want to delete this room?')) return;

    try {
      const { error } = await supabase.from('rooms').delete().eq('id', roomId);
      if (error) throw error;
      toast.success('Room deleted');
      fetchRooms();
    } catch (error: any) {
      logError('Error deleting room', error);
      toast.error(getSafeErrorMessage(error));
    }
  };

  const handleStatusChange = async (roomId: string, newStatus: RoomStatus) => {
    try {
      const { error } = await supabase
        .from('rooms')
        .update({ status: newStatus })
        .eq('id', roomId);
      if (error) throw error;
      toast.success('Room status updated');
      fetchRooms();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  // Group by derived status
  const roomsWithDerived = rooms.map(room => ({
    room,
    derived: getDerivedStatus(room),
    cleaningCountdown: getCleaningCountdown(room),
  }));

  const statusOrder: DerivedStatus[] = ['due_out', 'occupied', 'arriving', 'cleaning', 'dirty', 'maintenance', 'available'];

  const statusCounts = statusOrder.reduce((acc, s) => {
    acc[s] = roomsWithDerived.filter(r => r.derived.status === s).length;
    return acc;
  }, {} as Record<DerivedStatus, number>);

  return (
    <DashboardLayout title="Room Status">
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <div className="flex flex-wrap gap-2 sm:gap-4">
            {statusOrder.filter(s => statusCounts[s] > 0).map((status) => (
              <div key={status} className="flex items-center gap-1.5 sm:gap-2">
                <Badge variant="outline" className={`${derivedStatusConfig[status].color} text-xs sm:text-sm`}>
                  {derivedStatusConfig[status].label}
                </Badge>
                <span className="text-xs sm:text-sm text-muted-foreground">
                  ({statusCounts[status]})
                </span>
              </div>
            ))}
          </div>
          {isAdmin && (
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Room
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingRoom ? 'Edit Room' : 'Add New Room'}</DialogTitle>
                  <DialogDescription>
                    {editingRoom ? 'Update room details' : 'Add a new room to your property'}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="roomNumber">Room Number *</Label>
                      <Input
                        id="roomNumber"
                        value={roomNumber}
                        onChange={(e) => setRoomNumber(e.target.value)}
                        placeholder="101"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="roomType">Room Type</Label>
                      <Select value={roomType} onValueChange={setRoomType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {roomTypes.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type.charAt(0).toUpperCase() + type.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="price">Price per Night (Rs.) *</Label>
                      <Input
                        id="price"
                        type="number"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="5000"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maxGuests">Max Guests</Label>
                      <Input
                        id="maxGuests"
                        type="number"
                        value={maxGuests}
                        onChange={(e) => setMaxGuests(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="floor">Floor</Label>
                    <Input
                      id="floor"
                      type="number"
                      value={floor}
                      onChange={(e) => setFloor(e.target.value)}
                      placeholder="1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Ocean view room with balcony"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving...' : editingRoom ? 'Update' : 'Add Room'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Room Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : rooms.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <BedDouble className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No rooms added yet.</p>
              {isAdmin && (
                <Button
                  variant="link"
                  onClick={() => setDialogOpen(true)}
                  className="mt-2"
                >
                  Add your first room
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-4">
            {roomsWithDerived.map(({ room, derived, cleaningCountdown }) => {
              const config = derivedStatusConfig[derived.status];
              return (
                <Card
                  key={room.id}
                  className={`relative overflow-hidden border-t-[3px] ${
                    derived.status === 'available' ? 'border-t-success'
                    : derived.status === 'occupied' ? 'border-t-destructive'
                    : derived.status === 'due_out' ? 'border-t-warning'
                    : derived.status === 'arriving' ? 'border-t-info'
                    : derived.status === 'cleaning' ? 'border-t-warning'
                    : derived.status === 'dirty' ? 'border-t-warning'
                    : 'border-t-muted-foreground'
                  }`}
                >
                  <CardHeader className="p-2.5 sm:p-6 pb-1 sm:pb-2">
                    <div className="flex items-center justify-between gap-1">
                      <CardTitle className="text-sm sm:text-lg">Room {room.room_number}</CardTitle>
                      <div className="flex items-center gap-1">
                        <div className={`h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full shrink-0 ${
                          derived.status === 'available' ? 'bg-success'
                          : derived.status === 'occupied' ? 'bg-destructive'
                          : derived.status === 'due_out' ? 'bg-warning'
                          : derived.status === 'arriving' ? 'bg-info'
                          : 'bg-muted-foreground'
                        }`} />
                        <Badge variant="outline" className={`${config.color} text-[10px] sm:text-xs px-1 sm:px-2 py-0`}>
                          {config.label}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground capitalize">{room.room_type}</p>
                  </CardHeader>
                  <CardContent className="p-2.5 sm:p-6 pt-1 sm:pt-0 space-y-1.5 sm:space-y-4">
                    <div className="flex justify-between text-xs sm:text-sm">
                      <span className="text-muted-foreground">Rate</span>
                      <span className="font-medium">Rs. {room.price.toLocaleString()}</span>
                    </div>
                    <div className="hidden sm:flex justify-between text-sm">
                      <span className="text-muted-foreground">Max Guests</span>
                      <span>{room.max_guests}</span>
                    </div>
                    {room.floor && (
                      <div className="hidden sm:flex justify-between text-sm">
                        <span className="text-muted-foreground">Floor</span>
                        <span>{room.floor}</span>
                      </div>
                    )}
                    {derived.guestName && (
                      <div className="flex justify-between text-xs sm:text-sm">
                        <span className="text-muted-foreground">Guest</span>
                        <span className="font-medium truncate ml-1 sm:ml-2">{derived.guestName}</span>
                      </div>
                    )}
                    {cleaningCountdown && (
                      <div className="text-[10px] sm:text-xs text-orange-600 font-medium">
                        🧹 {cleaningCountdown}
                      </div>
                    )}

                    {/* Quick Actions */}
                    <div className="flex gap-1 sm:gap-2 pt-1 sm:pt-2">
                      {canWrite && (derived.status === 'dirty' || derived.status === 'cleaning') && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs h-7 sm:h-9"
                          onClick={() => handleMarkClean(room.id)}
                        >
                          <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-0.5 sm:mr-1" />
                          <span className="hidden sm:inline">Mark </span>Clean
                        </Button>
                      )}
                      {isAdmin && (
                        <Select
                          value={room.status}
                          onValueChange={(value) => handleStatusChange(room.id, value as RoomStatus)}
                        >
                          <SelectTrigger className="flex-1 h-7 sm:h-9 text-xs sm:text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="available">Available</SelectItem>
                            <SelectItem value="maintenance">Maintenance</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      {isAdmin && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 sm:h-9 sm:w-9"
                            onClick={() => openEditDialog(room)}
                          >
                            <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 sm:h-9 sm:w-9 text-destructive"
                            onClick={() => handleDelete(room.id)}
                          >
                            <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

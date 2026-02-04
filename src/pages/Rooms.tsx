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
import { Plus, Edit, Trash2, BedDouble, Wrench } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { getSafeErrorMessage, logError } from '@/lib/errorHandling';

type RoomStatus = 'available' | 'occupied' | 'reserved' | 'maintenance';

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
}

const roomTypes = ['standard', 'double', 'deluxe', 'suite', 'family', 'penthouse', 'apartment'];
const statusColors: Record<RoomStatus, string> = {
  available: 'bg-success/20 text-success border-success',
  occupied: 'bg-destructive/20 text-destructive border-destructive',
  reserved: 'bg-warning/20 text-warning-foreground border-warning',
  maintenance: 'bg-muted text-muted-foreground border-muted-foreground',
};

export default function Rooms() {
  // NOTE: isAdmin is for UI visibility only. Security is enforced by RLS policies on the database.
  const { isAdmin } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
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

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .order('room_number');

      if (error) throw error;
      setRooms((data as Room[]) || []);
    } catch (error) {
      console.error('Error fetching rooms:', error);
      toast.error('Failed to load rooms');
    } finally {
      setLoading(false);
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
      };

      if (editingRoom) {
        const { error } = await supabase
          .from('rooms')
          .update(roomData)
          .eq('id', editingRoom.id);
        if (error) throw error;
        toast.success('Room updated successfully');
      } else {
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

  const groupedRooms = rooms.reduce((acc, room) => {
    const status = room.status;
    if (!acc[status]) acc[status] = [];
    acc[status].push(room);
    return acc;
  }, {} as Record<RoomStatus, Room[]>);

  const statusOrder: RoomStatus[] = ['available', 'occupied', 'reserved', 'maintenance'];

  return (
    <DashboardLayout title="Room Status">
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <div className="flex flex-wrap gap-2 sm:gap-4">
            {statusOrder.map((status) => (
              <div key={status} className="flex items-center gap-1.5 sm:gap-2">
                <Badge variant="outline" className={`${statusColors[status]} text-xs sm:text-sm`}>
                  {status}
                </Badge>
                <span className="text-xs sm:text-sm text-muted-foreground">
                  ({groupedRooms[status]?.length || 0})
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {rooms.map((room) => (
              <Card
                key={room.id}
                className={`relative overflow-hidden ${
                  room.status === 'available'
                    ? 'border-success/50'
                    : room.status === 'occupied'
                    ? 'border-destructive/50'
                    : room.status === 'reserved'
                    ? 'border-warning/50'
                    : 'border-muted'
                }`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Room {room.room_number}</CardTitle>
                    <Badge variant="outline" className={statusColors[room.status]}>
                      {room.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground capitalize">{room.room_type}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Rate</span>
                    <span className="font-medium">Rs. {room.price.toLocaleString()}/night</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Max Guests</span>
                    <span>{room.max_guests}</span>
                  </div>
                  {room.floor && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Floor</span>
                      <span>{room.floor}</span>
                    </div>
                  )}

                  {/* Quick Actions */}
                  <div className="flex gap-2 pt-2">
                    <Select
                      value={room.status}
                      onValueChange={(value) => handleStatusChange(room.id, value as RoomStatus)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="available">Available</SelectItem>
                        <SelectItem value="occupied">Occupied</SelectItem>
                        <SelectItem value="reserved">Reserved</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                      </SelectContent>
                    </Select>
                    {isAdmin && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(room)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => handleDelete(room.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

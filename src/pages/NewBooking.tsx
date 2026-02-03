import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Search, Plus, User } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { z } from 'zod';
import { getSafeErrorMessage, logError } from '@/lib/errorHandling';

const bookingSchema = z.object({
  guestName: z.string().trim().min(2, 'Guest name is required'),
  guestPhone: z.string().trim().min(5, 'Phone number is required'),
  guestEmail: z.string().email().optional().or(z.literal('')),
  roomId: z.string().min(1, 'Please select a room'),
  checkIn: z.date({ required_error: 'Check-in date is required' }),
  checkOut: z.date({ required_error: 'Check-out date is required' }),
  numGuests: z.number().min(1, 'At least 1 guest required'),
});

interface Room {
  id: string;
  room_number: string;
  room_type: string;
  price: number;
  status: string;
  max_guests: number;
}

interface Guest {
  id: string;
  name: string;
  phone: string;
  email: string | null;
}

export default function NewBooking() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [existingGuests, setExistingGuests] = useState<Guest[]>([]);
  const [guestSearch, setGuestSearch] = useState('');
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [showGuestSearch, setShowGuestSearch] = useState(false);

  // Form state
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestIdPassport, setGuestIdPassport] = useState('');
  const [roomId, setRoomId] = useState('');
  const [checkIn, setCheckIn] = useState<Date>();
  const [checkOut, setCheckOut] = useState<Date>();
  const [numGuests, setNumGuests] = useState(1);
  const [specialRequests, setSpecialRequests] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');

  useEffect(() => {
    fetchAvailableRooms();
    fetchExistingGuests();
  }, [checkIn, checkOut]);

  const fetchAvailableRooms = async () => {
    try {
      let query = supabase.from('rooms').select('*').eq('status', 'available');
      const { data } = await query;
      setRooms(data || []);
    } catch (error) {
      console.error('Error fetching rooms:', error);
    }
  };

  const fetchExistingGuests = async () => {
    try {
      const { data } = await supabase
        .from('guests')
        .select('id, name, phone, email')
        .order('name');
      setExistingGuests(data || []);
    } catch (error) {
      console.error('Error fetching guests:', error);
    }
  };

  const handleSelectGuest = (guest: Guest) => {
    setSelectedGuest(guest);
    setGuestName(guest.name);
    setGuestPhone(guest.phone || '');
    setGuestEmail(guest.email || '');
    setShowGuestSearch(false);
    setGuestSearch('');
  };

  const calculateTotal = () => {
    if (!checkIn || !checkOut || !roomId) return 0;
    const room = rooms.find((r) => r.id === roomId);
    if (!room) return 0;
    const nights = differenceInDays(checkOut, checkIn);
    return room.price * Math.max(nights, 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = bookingSchema.safeParse({
      guestName,
      guestPhone,
      guestEmail: guestEmail || undefined,
      roomId,
      checkIn,
      checkOut,
      numGuests,
    });

    if (!result.success) {
      toast.error(result.error.errors[0].message);
      return;
    }

    if (checkOut && checkIn && checkOut <= checkIn) {
      toast.error('Check-out must be after check-in');
      return;
    }

    setLoading(true);

    try {
      let guestId = selectedGuest?.id;

      // Create new guest if not selected from existing
      if (!guestId) {
        const { data: newGuest, error: guestError } = await supabase
          .from('guests')
          .insert({
            name: guestName.trim(),
            phone: guestPhone.trim(),
            email: guestEmail.trim() || null,
            id_passport: guestIdPassport.trim() || null,
          })
          .select()
          .single();

        if (guestError) throw guestError;
        guestId = newGuest.id;
      }

      // Create booking
      const { error: bookingError } = await supabase.from('bookings').insert({
        guest_id: guestId,
        room_id: roomId,
        check_in: format(checkIn!, 'yyyy-MM-dd'),
        check_out: format(checkOut!, 'yyyy-MM-dd'),
        num_guests: numGuests,
        status: 'confirmed',
        special_requests: specialRequests.trim() || null,
        total_amount: calculateTotal(),
        created_by: user?.id,
      });

      if (bookingError) throw bookingError;

      // Update room status to reserved
      await supabase.from('rooms').update({ status: 'reserved' }).eq('id', roomId);

      toast.success('Booking created successfully!');
      navigate('/bookings');
    } catch (error: any) {
      logError('Error creating booking', error);
      toast.error(getSafeErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const filteredGuests = existingGuests.filter(
    (g) =>
      g.name.toLowerCase().includes(guestSearch.toLowerCase()) ||
      g.phone?.includes(guestSearch)
  );

  const selectedRoom = rooms.find((r) => r.id === roomId);

  return (
    <DashboardLayout title="New Booking">
      <div className="max-w-4xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Guest Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Guest Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search existing guest */}
              <div className="relative">
                <Label>Search Existing Guest</Label>
                <div className="relative mt-1.5">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or phone..."
                    value={guestSearch}
                    onChange={(e) => {
                      setGuestSearch(e.target.value);
                      setShowGuestSearch(true);
                    }}
                    onFocus={() => setShowGuestSearch(true)}
                    className="pl-10"
                  />
                </div>
                {showGuestSearch && guestSearch && (
                  <div className="absolute z-10 w-full mt-1 bg-card border rounded-md shadow-lg max-h-60 overflow-auto">
                    {filteredGuests.length === 0 ? (
                      <div className="p-3 text-sm text-muted-foreground">
                        No guests found. Fill in details below to create new.
                      </div>
                    ) : (
                      filteredGuests.map((guest) => (
                        <button
                          key={guest.id}
                          type="button"
                          onClick={() => handleSelectGuest(guest)}
                          className="w-full px-3 py-2 text-left hover:bg-muted flex justify-between items-center"
                        >
                          <span className="font-medium">{guest.name}</span>
                          <span className="text-sm text-muted-foreground">{guest.phone}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {selectedGuest && (
                <div className="p-3 bg-muted rounded-lg flex items-center justify-between">
                  <div>
                    <p className="font-medium">{selectedGuest.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedGuest.phone}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedGuest(null);
                      setGuestName('');
                      setGuestPhone('');
                      setGuestEmail('');
                    }}
                  >
                    Change
                  </Button>
                </div>
              )}

              {!selectedGuest && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="guestName">Full Name *</Label>
                    <Input
                      id="guestName"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="John Smith"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="guestPhone">Phone *</Label>
                    <Input
                      id="guestPhone"
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(e.target.value)}
                      placeholder="+94 77 123 4567"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="guestEmail">Email</Label>
                    <Input
                      id="guestEmail"
                      type="email"
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      placeholder="john@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="guestIdPassport">ID / Passport</Label>
                    <Input
                      id="guestIdPassport"
                      value={guestIdPassport}
                      onChange={(e) => setGuestIdPassport(e.target.value)}
                      placeholder="Passport number"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Booking Details */}
          <Card>
            <CardHeader>
              <CardTitle>Booking Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Check-in Date */}
                <div className="space-y-2">
                  <Label>Check-in Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !checkIn && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {checkIn ? format(checkIn, 'PPP') : 'Select date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={checkIn}
                        onSelect={setCheckIn}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Check-out Date */}
                <div className="space-y-2">
                  <Label>Check-out Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !checkOut && 'text-muted-foreground'
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {checkOut ? format(checkOut, 'PPP') : 'Select date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={checkOut}
                        onSelect={setCheckOut}
                        disabled={(date) => date <= (checkIn || new Date())}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Room Selection */}
                <div className="space-y-2">
                  <Label>Select Room *</Label>
                  <Select value={roomId} onValueChange={setRoomId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select available room" />
                    </SelectTrigger>
                    <SelectContent>
                      {rooms.length === 0 ? (
                        <SelectItem value="none" disabled>
                          No rooms available
                        </SelectItem>
                      ) : (
                        rooms.map((room) => (
                          <SelectItem key={room.id} value={room.id}>
                            Room {room.room_number} - {room.room_type} (Rs.{' '}
                            {room.price.toLocaleString()}/night)
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Number of Guests */}
                <div className="space-y-2">
                  <Label>Number of Guests</Label>
                  <Select
                    value={numGuests.toString()}
                    onValueChange={(v) => setNumGuests(parseInt(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <SelectItem key={n} value={n.toString()}>
                          {n} {n === 1 ? 'guest' : 'guests'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Payment Method */}
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="online">Online Payment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Special Requests */}
              <div className="space-y-2">
                <Label>Special Requests</Label>
                <Textarea
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  placeholder="Any special requirements or notes..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Summary & Submit */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  {selectedRoom && checkIn && checkOut && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">
                        Room {selectedRoom.room_number} × {differenceInDays(checkOut, checkIn)}{' '}
                        nights
                      </p>
                      <p className="text-2xl font-bold">
                        Rs. {calculateTotal().toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/bookings')}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Creating...' : 'Create Booking'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </DashboardLayout>
  );
}

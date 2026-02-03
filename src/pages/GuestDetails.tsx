import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, User, Calendar, Plus, Receipt, Printer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { getSafeErrorMessage, logError } from '@/lib/errorHandling';

interface GuestDetails {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  id_passport: string | null;
  address: string | null;
  nationality: string | null;
  notes: string | null;
  created_at: string;
}

interface Booking {
  id: string;
  check_in: string;
  check_out: string;
  status: string;
  total_amount: number;
  rooms: { room_number: string; room_type: string } | null;
}

interface GuestService {
  id: string;
  service_date: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  services: { name: string } | null;
}

interface Service {
  id: string;
  name: string;
  price: number;
  category: string;
}

export default function GuestDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [guest, setGuest] = useState<GuestDetails | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [guestServices, setGuestServices] = useState<GuestService[]>([]);
  const [availableServices, setAvailableServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  // Add service dialog state
  const [showAddService, setShowAddService] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) {
      fetchGuestDetails();
      fetchBookings();
      fetchGuestServices();
      fetchAvailableServices();
    }
  }, [id]);

  const fetchGuestDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('guests')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setGuest(data);
    } catch (error) {
      logError('Error fetching guest', error);
      toast.error(getSafeErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const fetchBookings = async () => {
    try {
      const { data } = await supabase
        .from('bookings')
        .select(`
          id,
          check_in,
          check_out,
          status,
          total_amount,
          rooms (room_number, room_type)
        `)
        .eq('guest_id', id)
        .order('check_in', { ascending: false });

      setBookings(data || []);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    }
  };

  const fetchGuestServices = async () => {
    try {
      const { data } = await supabase
        .from('guest_services')
        .select(`
          id,
          service_date,
          quantity,
          unit_price,
          total_price,
          services (name)
        `)
        .eq('booking_id', bookings.find((b) => b.status === 'checked_in')?.id || '')
        .order('service_date', { ascending: false });

      setGuestServices(data || []);
    } catch (error) {
      console.error('Error fetching services:', error);
    }
  };

  const fetchAvailableServices = async () => {
    try {
      const { data } = await supabase
        .from('services')
        .select('id, name, price, category')
        .eq('is_active', true)
        .order('name');

      setAvailableServices(data || []);
    } catch (error) {
      console.error('Error fetching available services:', error);
    }
  };

  const handleAddService = async () => {
    if (!selectedBookingId || !selectedServiceId || !quantity) {
      toast.error('Please fill in all fields');
      return;
    }

    setSaving(true);
    try {
      const service = availableServices.find((s) => s.id === selectedServiceId);
      if (!service) throw new Error('Service not found');

      const qty = parseInt(quantity);
      const totalPrice = service.price * qty;

      const { error } = await supabase.from('guest_services').insert({
        booking_id: selectedBookingId,
        service_id: selectedServiceId,
        quantity: qty,
        unit_price: service.price,
        total_price: totalPrice,
        service_date: new Date().toISOString().split('T')[0],
        created_by: user?.id,
      });

      if (error) throw error;

      toast.success('Service added to guest');
      setShowAddService(false);
      setSelectedServiceId('');
      setQuantity('1');
      fetchGuestServices();
    } catch (error: any) {
      logError('Error adding service', error);
      toast.error(getSafeErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const activeBooking = bookings.find((b) => b.status === 'checked_in');

  if (loading) {
    return (
      <DashboardLayout title="Guest Details">
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </DashboardLayout>
    );
  }

  if (!guest) {
    return (
      <DashboardLayout title="Guest Details">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Guest not found</p>
          <Button variant="link" onClick={() => navigate('/guests')}>
            Return to guests
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Guest Details">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/guests')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Guests
          </Button>
          {activeBooking && (
            <Button onClick={() => setShowAddService(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Service
            </Button>
          )}
        </div>

        {/* Guest Info Card */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-4">
            <div className="p-4 rounded-xl bg-primary/10">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-2xl">{guest.name}</CardTitle>
              <p className="text-muted-foreground">
                Guest since {format(new Date(guest.created_at), 'MMMM yyyy')}
              </p>
            </div>
            {activeBooking && (
              <Badge className="bg-success/20 text-success border-success">
                Currently Checked In
              </Badge>
            )}
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Phone</p>
              <p className="font-medium">{guest.phone || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{guest.email || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">ID / Passport</p>
              <p className="font-medium">{guest.id_passport || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Nationality</p>
              <p className="font-medium">{guest.nationality || 'N/A'}</p>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="bookings">
          <TabsList>
            <TabsTrigger value="bookings">Booking History</TabsTrigger>
            <TabsTrigger value="services">Services</TabsTrigger>
          </TabsList>

          <TabsContent value="bookings" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Booking History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {bookings.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    No bookings found
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
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
                        <TableRow key={booking.id}>
                          <TableCell>
                            <div>
                              <p>Room {booking.rooms?.room_number}</p>
                              <p className="text-sm text-muted-foreground capitalize">
                                {booking.rooms?.room_type}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {format(new Date(booking.check_in), 'PP')}
                          </TableCell>
                          <TableCell>
                            {format(new Date(booking.check_out), 'PP')}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{booking.status.replace('_', ' ')}</Badge>
                          </TableCell>
                          <TableCell>Rs. {booking.total_amount?.toLocaleString()}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/bookings/${booking.id}`)}
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="services" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Services (Current Stay)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!activeBooking ? (
                  <p className="text-center py-8 text-muted-foreground">
                    Guest is not currently checked in
                  </p>
                ) : guestServices.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    No services added yet
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Service</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Unit Price</TableHead>
                        <TableHead>Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {guestServices.map((service) => (
                        <TableRow key={service.id}>
                          <TableCell className="font-medium">
                            {service.services?.name}
                          </TableCell>
                          <TableCell>
                            {format(new Date(service.service_date), 'PP')}
                          </TableCell>
                          <TableCell>{service.quantity}</TableCell>
                          <TableCell>Rs. {service.unit_price.toLocaleString()}</TableCell>
                          <TableCell className="font-medium">
                            Rs. {service.total_price.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Service Dialog */}
      <Dialog open={showAddService} onOpenChange={setShowAddService}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Service</DialogTitle>
            <DialogDescription>
              Add a service charge to the guest's current stay
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Service</Label>
              <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a service" />
                </SelectTrigger>
                <SelectContent>
                  {availableServices.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name} - Rs. {service.price.toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min="1"
              />
            </div>
            {selectedServiceId && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-xl font-bold">
                  Rs.{' '}
                  {(
                    (availableServices.find((s) => s.id === selectedServiceId)?.price || 0) *
                    parseInt(quantity || '1')
                  ).toLocaleString()}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddService(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setSelectedBookingId(activeBooking?.id || '');
                handleAddService();
              }}
              disabled={saving}
            >
              {saving ? 'Adding...' : 'Add Service'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, User, Calendar, Receipt, Edit, MapPin, Phone, Mail, CreditCard, Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { getSafeErrorMessage, logError } from '@/lib/errorHandling';
import { EditGuestDialog } from '@/components/guest/EditGuestDialog';
import { useAuth } from '@/hooks/useAuth';

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
  booking_source: string;
  rooms: { room_number: string; room_type: string } | null;
}

interface GuestService {
  id: string;
  service_date: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  booking_id: string;
  services: { name: string; category: string } | null;
  bookings: { check_in: string; rooms: { room_number: string } | null } | null;
}

export default function GuestDetails() {
  const { canWrite } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();

  const [guest, setGuest] = useState<GuestDetails | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [allServices, setAllServices] = useState<GuestService[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditDialog, setShowEditDialog] = useState(false);

  useEffect(() => {
    if (id) {
      fetchGuestDetails();
      fetchBookings();
    }
  }, [id]);

  useEffect(() => {
    if (bookings.length > 0) {
      fetchAllGuestServices();
    }
  }, [bookings]);

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
          booking_source,
          rooms (room_number, room_type)
        `)
        .eq('guest_id', id)
        .order('check_in', { ascending: false });

      setBookings(data || []);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    }
  };

  const fetchAllGuestServices = async () => {
    try {
      const bookingIds = bookings.map((b) => b.id);
      if (bookingIds.length === 0) return;

      const { data } = await supabase
        .from('guest_services')
        .select(`
          id,
          service_date,
          quantity,
          unit_price,
          total_price,
          booking_id,
          services (name, category),
          bookings (check_in, rooms (room_number))
        `)
        .in('booking_id', bookingIds)
        .order('service_date', { ascending: false });

      setAllServices(data || []);
    } catch (error) {
      console.error('Error fetching services:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      pending: 'bg-warning/20 text-warning border-warning',
      confirmed: 'bg-info/20 text-info border-info',
      checked_in: 'bg-success/20 text-success border-success',
      checked_out: 'bg-muted text-muted-foreground',
      cancelled: 'bg-destructive/20 text-destructive border-destructive',
    };

    return (
      <Badge variant="outline" className={variants[status] || ''}>
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const activeBooking = bookings.find((b) => b.status === 'checked_in');
  const totalServicesValue = allServices.reduce((sum, s) => sum + Number(s.total_price), 0);
  const totalBookingsValue = bookings.reduce((sum, b) => sum + Number(b.total_amount), 0);

  // Group services by category for summary
  const servicesByCategory = allServices.reduce((acc, service) => {
    const category = service.services?.category || 'other';
    if (!acc[category]) {
      acc[category] = { count: 0, total: 0 };
    }
    acc[category].count += service.quantity;
    acc[category].total += Number(service.total_price);
    return acc;
  }, {} as Record<string, { count: number; total: number }>);

  const categoryLabels: Record<string, string> = {
    room_service: 'Room Service',
    transport: 'Transport',
    facilities: 'Facilities',
    special_request: 'Special Requests',
  };

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
          <Button variant="ghost" onClick={() => navigate('/settings?tab=guests')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Guests
          </Button>
          {canWrite && (
            <Button variant="outline" onClick={() => setShowEditDialog(true)}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Guest
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
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Phone / WhatsApp</p>
                  <p className="font-medium">{guest.phone || 'Not provided'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{guest.email || 'Not provided'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CreditCard className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">ID / Passport</p>
                  <p className="font-medium">{guest.id_passport || 'Not provided'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Nationality</p>
                  <p className="font-medium">{guest.nationality || 'Not provided'}</p>
                </div>
              </div>
            </div>
            
            {(guest.address || guest.notes) && (
              <div className="mt-6 pt-6 border-t grid grid-cols-1 md:grid-cols-2 gap-6">
                {guest.address && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Address</p>
                    <p className="font-medium">{guest.address}</p>
                  </div>
                )}
                {guest.notes && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Notes</p>
                    <p className="text-muted-foreground">{guest.notes}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-info/10">
                  <Calendar className="h-6 w-6 text-info" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Bookings</p>
                  <p className="text-2xl font-bold">{bookings.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-success/10">
                  <CreditCard className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Room Charges</p>
                  <p className="text-2xl font-bold">Rs. {totalBookingsValue.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-warning/10">
                  <Receipt className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Services</p>
                  <p className="text-2xl font-bold">Rs. {totalServicesValue.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="bookings">
          <TabsList>
            <TabsTrigger value="bookings">Booking History</TabsTrigger>
            <TabsTrigger value="services">Services Purchased</TabsTrigger>
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
                        <TableHead>Source</TableHead>
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
                              <p className="font-medium">Room {booking.rooms?.room_number}</p>
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
                            <Badge variant="outline" className="capitalize">
                              {booking.booking_source.replace('_', '.')}
                            </Badge>
                          </TableCell>
                          <TableCell>{getStatusBadge(booking.status)}</TableCell>
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

          <TabsContent value="services" className="mt-6 space-y-6">
            {/* Services Summary by Category */}
            {Object.keys(servicesByCategory).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Services Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(servicesByCategory).map(([category, data]) => (
                      <div key={category} className="p-4 bg-muted rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          {categoryLabels[category] || category}
                        </p>
                        <p className="text-xl font-bold">Rs. {data.total.toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">{data.count} items</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* All Services Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  All Services (All Stays)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {allServices.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    No services purchased yet
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Service</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Stay</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Unit Price</TableHead>
                        <TableHead>Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allServices.map((service) => (
                        <TableRow key={service.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{service.services?.name}</p>
                              <p className="text-sm text-muted-foreground capitalize">
                                {categoryLabels[service.services?.category || ''] || service.services?.category}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            {format(new Date(service.service_date), 'PP')}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <p>Room {service.bookings?.rooms?.room_number}</p>
                              <p className="text-muted-foreground">
                                {service.bookings?.check_in
                                  ? format(new Date(service.bookings.check_in), 'MMM d, yyyy')
                                  : '-'}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>{service.quantity}</TableCell>
                          <TableCell>Rs. {Number(service.unit_price).toLocaleString()}</TableCell>
                          <TableCell className="font-medium">
                            Rs. {Number(service.total_price).toLocaleString()}
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

      {/* Edit Guest Dialog */}
      <EditGuestDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        guest={guest}
        onSuccess={fetchGuestDetails}
      />
    </DashboardLayout>
  );
}

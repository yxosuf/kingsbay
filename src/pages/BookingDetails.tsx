import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { User, BedDouble, Calendar, CreditCard, ArrowLeft, Printer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format, differenceInDays } from 'date-fns';

interface BookingDetails {
  id: string;
  check_in: string;
  check_out: string;
  status: string;
  num_guests: number;
  total_amount: number;
  special_requests: string | null;
  created_at: string;
  guests: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    id_passport: string | null;
  } | null;
  rooms: {
    id: string;
    room_number: string;
    room_type: string;
    price: number;
  } | null;
}

interface GuestService {
  id: string;
  service_date: string;
  quantity: number;
  total_price: number;
  services: { name: string; category: string } | null;
}

export default function BookingDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isCheckout = location.pathname.includes('/checkout');

  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [services, setServices] = useState<GuestService[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showCheckoutDialog, setShowCheckoutDialog] = useState(isCheckout);

  useEffect(() => {
    if (id) {
      fetchBookingDetails();
      fetchGuestServices();
    }
  }, [id]);

  const fetchBookingDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          guests (*),
          rooms (*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setBooking(data);
    } catch (error) {
      console.error('Error fetching booking:', error);
      toast.error('Failed to load booking details');
    } finally {
      setLoading(false);
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
          total_price,
          services (name, category)
        `)
        .eq('booking_id', id);

      setServices(data || []);
    } catch (error) {
      console.error('Error fetching services:', error);
    }
  };

  const handleCheckout = async () => {
    if (!booking) return;

    setProcessing(true);
    try {
      // Calculate totals
      const roomCharges = booking.total_amount;
      const serviceCharges = services.reduce((sum, s) => sum + Number(s.total_price), 0);
      const taxRate = 0.1; // 10% tax
      const taxAmount = (roomCharges + serviceCharges) * taxRate;
      const totalAmount = roomCharges + serviceCharges + taxAmount;

      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          invoice_number: `INV-${Date.now()}`,
          booking_id: booking.id,
          room_charges: roomCharges,
          service_charges: serviceCharges,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          payment_status: 'pending' as const,
          created_by: user?.id,
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Update booking status
      const { error: bookingError } = await supabase
        .from('bookings')
        .update({ status: 'checked_out' })
        .eq('id', booking.id);

      if (bookingError) throw bookingError;

      // Update room status
      await supabase
        .from('rooms')
        .update({ status: 'available' })
        .eq('id', booking.rooms?.id);

      toast.success('Guest checked out successfully. Invoice created.');
      setShowCheckoutDialog(false);
      navigate(`/bookings`);
    } catch (error: any) {
      console.error('Error during checkout:', error);
      toast.error(error.message || 'Failed to process checkout');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      pending: 'bg-warning/20 text-warning-foreground border-warning',
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

  if (loading) {
    return (
      <DashboardLayout title="Booking Details">
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </DashboardLayout>
    );
  }

  if (!booking) {
    return (
      <DashboardLayout title="Booking Details">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Booking not found</p>
          <Button variant="link" onClick={() => navigate('/bookings')}>
            Return to bookings
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const nights = differenceInDays(
    new Date(booking.check_out),
    new Date(booking.check_in)
  );
  const serviceTotal = services.reduce((sum, s) => sum + Number(s.total_price), 0);
  const taxAmount = (booking.total_amount + serviceTotal) * 0.1;
  const grandTotal = booking.total_amount + serviceTotal + taxAmount;

  return (
    <DashboardLayout title="Booking Details">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/bookings')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Bookings
          </Button>
          <div className="flex gap-2">
            {booking.status === 'checked_in' && (
              <Button onClick={() => setShowCheckoutDialog(true)}>
                Check Out & Generate Invoice
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Guest Card */}
            <Card>
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle>{booking.guests?.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">Guest Information</p>
                </div>
                {getStatusBadge(booking.status)}
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{booking.guests?.phone || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{booking.guests?.email || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">ID / Passport</p>
                  <p className="font-medium">{booking.guests?.id_passport || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Number of Guests</p>
                  <p className="font-medium">{booking.num_guests}</p>
                </div>
              </CardContent>
            </Card>

            {/* Room Card */}
            <Card>
              <CardHeader className="flex flex-row items-center gap-4">
                <div className="p-3 rounded-xl bg-info/10">
                  <BedDouble className="h-6 w-6 text-info" />
                </div>
                <div>
                  <CardTitle>Room {booking.rooms?.room_number}</CardTitle>
                  <p className="text-sm text-muted-foreground capitalize">
                    {booking.rooms?.room_type}
                  </p>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Check-in</p>
                  <p className="font-medium">
                    {format(new Date(booking.check_in), 'PPP')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Check-out</p>
                  <p className="font-medium">
                    {format(new Date(booking.check_out), 'PPP')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p className="font-medium">{nights} nights</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Rate per Night</p>
                  <p className="font-medium">Rs. {booking.rooms?.price.toLocaleString()}</p>
                </div>
              </CardContent>
            </Card>

            {/* Services */}
            {services.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Services Used</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {services.map((service) => (
                      <div
                        key={service.id}
                        className="flex items-center justify-between py-2 border-b last:border-0"
                      >
                        <div>
                          <p className="font-medium">{service.services?.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(service.service_date), 'PP')} × {service.quantity}
                          </p>
                        </div>
                        <p className="font-medium">
                          Rs. {Number(service.total_price).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {booking.special_requests && (
              <Card>
                <CardHeader>
                  <CardTitle>Special Requests</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{booking.special_requests}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Summary */}
          <div>
            <Card className="sticky top-20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Billing Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Room Charges</span>
                  <span>Rs. {booking.total_amount.toLocaleString()}</span>
                </div>
                {serviceTotal > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Service Charges</span>
                    <span>Rs. {serviceTotal.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax (10%)</span>
                  <span>Rs. {taxAmount.toLocaleString()}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>Rs. {grandTotal.toLocaleString()}</span>
                </div>

                {booking.status === 'checked_in' && (
                  <Button
                    className="w-full mt-4"
                    onClick={() => setShowCheckoutDialog(true)}
                  >
                    Process Checkout
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Checkout Dialog */}
      <Dialog open={showCheckoutDialog} onOpenChange={setShowCheckoutDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Checkout</DialogTitle>
            <DialogDescription>
              This will check out the guest and generate an invoice for payment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex justify-between">
              <span>Room Charges ({nights} nights)</span>
              <span>Rs. {booking.total_amount.toLocaleString()}</span>
            </div>
            {serviceTotal > 0 && (
              <div className="flex justify-between">
                <span>Services</span>
                <span>Rs. {serviceTotal.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Tax (10%)</span>
              <span>Rs. {taxAmount.toLocaleString()}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-bold text-lg">
              <span>Total Due</span>
              <span>Rs. {grandTotal.toLocaleString()}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCheckoutDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCheckout} disabled={processing}>
              {processing ? 'Processing...' : 'Confirm Checkout'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

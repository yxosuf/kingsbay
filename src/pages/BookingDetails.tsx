import { useState, useEffect, useRef } from 'react';
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
import { User, BedDouble, Calendar, CreditCard, ArrowLeft, Printer, Globe, Plus, CalendarPlus, Link as LinkIcon, Mail, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useFxRate } from '@/hooks/useFxRate';
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay';
import { TransactionsTab } from '@/components/booking/TransactionsTab';
import { postBookingConfirmed, postCommission } from '@/lib/ledgerUtils';
import { toast } from 'sonner';
import { format, differenceInDays } from 'date-fns';
import { ExtendStayDialog } from '@/components/booking/ExtendStayDialog';
import { AddServiceDialog } from '@/components/booking/AddServiceDialog';
import { PrintableInvoice } from '@/components/invoice/PrintableInvoice';
import { useReactToPrint } from 'react-to-print';
import { BookingTimeline } from '@/components/booking/BookingTimeline';
import { BookingStatusBadge } from '@/components/booking/BookingStatusBadge';
import { AdminStatusOverride } from '@/components/booking/AdminStatusOverride';

interface BookingDetails {
  id: string;
  property_id: string | null;
  check_in: string;
  check_out: string;
  status: string;
  num_guests: number;
  total_amount: number;
  special_requests: string | null;
  created_at: string;
  booking_source: string;
  ota_price: number | null;
  commission_rate: number | null;
  commission_amount: number | null;
  ota_reference: string | null;
  parent_booking_id: string | null;
  guest_id: string;
  room_id: string;
  external_source: string | null;
  external_booking_id: string | null;
  imported_via: string | null;
  needs_review: boolean | null;
  review_reason: string | null;
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
  const { user, isAdmin } = useAuth();
  const isCheckout = location.pathname.includes('/checkout');

  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [services, setServices] = useState<GuestService[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showCheckoutDialog, setShowCheckoutDialog] = useState(isCheckout);
  const [showExtendDialog, setShowExtendDialog] = useState(false);
  const [showAddServiceDialog, setShowAddServiceDialog] = useState(false);
  const [linkedBookings, setLinkedBookings] = useState<{id: string; check_in: string; check_out: string; rooms: {room_number: string} | null}[]>([]);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const { fxRate } = useFxRate(booking?.property_id);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Invoice-${invoiceNumber || 'preview'}`,
    onAfterPrint: () => {
      toast.success('Invoice printed successfully');
    },
  });

  useEffect(() => {
    if (id) {
      fetchBookingDetails();
      fetchGuestServices();
      fetchLinkedBookings();
    }
  }, [id]);

  // FX rate is now handled by useFxRate hook above

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
      
      // Fetch existing invoice if booking is checked out
      if (data?.status === 'checked_out') {
        const { data: invoiceData } = await supabase
          .from('invoices')
          .select('invoice_number')
          .eq('booking_id', data.id)
          .maybeSingle();
        
        if (invoiceData) {
          setInvoiceNumber(invoiceData.invoice_number);
        }
      }
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

  const fetchLinkedBookings = async () => {
    try {
      // Get child bookings (continuations of this booking)
      const { data: children } = await supabase
        .from('bookings')
        .select('id, check_in, check_out, rooms(room_number)')
        .eq('parent_booking_id', id);
      
      // Get parent booking if this is a child
      const { data: parentData } = await supabase
        .from('bookings')
        .select('parent_booking_id')
        .eq('id', id)
        .maybeSingle();
      
      let siblings: typeof children = [];
      if (parentData?.parent_booking_id) {
        const { data: parent } = await supabase
          .from('bookings')
          .select('id, check_in, check_out, rooms(room_number)')
          .eq('id', parentData.parent_booking_id);
        
        const { data: otherChildren } = await supabase
          .from('bookings')
          .select('id, check_in, check_out, rooms(room_number)')
          .eq('parent_booking_id', parentData.parent_booking_id)
          .neq('id', id);
        
        siblings = [...(parent || []), ...(otherChildren || [])];
      }

      setLinkedBookings([...(children || []), ...siblings]);
    } catch (error) {
      console.error('Error fetching linked bookings:', error);
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

      // Update room: set housekeeping to cleaning with timer, release booking status
      const cleaningMinutes = 90; // default, could fetch from property settings
      const cleaningUntil = new Date(Date.now() + cleaningMinutes * 60 * 1000).toISOString();
      await supabase
        .from('rooms')
        .update({
          status: 'available',
          housekeeping_status: 'cleaning',
          last_checkout_at: new Date().toISOString(),
          cleaning_until: cleaningUntil,
        } as any)
        .eq('id', booking.rooms?.id);

      // Update booking with checkout timestamp
      await supabase
        .from('bookings')
        .update({ checked_out_at: new Date().toISOString() })
        .eq('id', booking.id);

      setInvoiceNumber(invoice.invoice_number);
      toast.success('Guest checked out successfully. Invoice created.');
      setShowCheckoutDialog(false);
      setShowPrintPreview(true);
    } catch (error: any) {
      console.error('Error during checkout:', error);
      toast.error(error.message || 'Failed to process checkout');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    return <BookingStatusBadge status={status} needsReview={booking?.needs_review} />;
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" onClick={() => navigate('/bookings')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Bookings
          </Button>
          <div className="flex flex-wrap gap-2">
            {(booking.status === 'checked_in' || booking.status === 'confirmed') && (
              <>
                <Button variant="outline" onClick={() => setShowAddServiceDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Service
                </Button>
                <Button variant="outline" onClick={() => setShowExtendDialog(true)}>
                  <CalendarPlus className="h-4 w-4 mr-2" />
                  Extend Stay
                </Button>
              </>
            )}
            {booking.status === 'checked_in' && (
              <Button onClick={() => setShowCheckoutDialog(true)}>
                Check Out & Generate Invoice
              </Button>
            )}
            {booking.status === 'checked_out' && invoiceNumber && (
              <Button variant="outline" onClick={() => setShowPrintPreview(true)}>
                <Printer className="h-4 w-4 mr-2" />
                Print Invoice
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

            {/* OTA Booking Info */}
            {booking.booking_source && booking.booking_source !== 'direct' && (
              <Card>
                <CardHeader className="flex flex-row items-center gap-4">
                  <div className="p-3 rounded-xl bg-warning/10">
                    <Globe className="h-6 w-6 text-warning" />
                  </div>
                  <div>
                    <CardTitle>OTA Booking Details</CardTitle>
                    <p className="text-sm text-muted-foreground capitalize">
                      {booking.booking_source.replace('_', '.')}
                    </p>
                  </div>
                  {booking.needs_review && (
                    <Badge variant="destructive" className="ml-auto">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Needs Review
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  {booking.external_booking_id && (
                    <div>
                      <p className="text-sm text-muted-foreground">External Booking ID</p>
                      <p className="font-medium font-mono">{booking.external_booking_id}</p>
                    </div>
                  )}
                  {booking.external_source && (
                    <div>
                      <p className="text-sm text-muted-foreground">Source</p>
                      <p className="font-medium">{booking.external_source}</p>
                    </div>
                  )}
                  {booking.imported_via && (
                    <div>
                      <p className="text-sm text-muted-foreground">Imported Via</p>
                      <Badge variant="outline" className="mt-1">
                        <Mail className="h-3 w-3 mr-1" />
                        {booking.imported_via}
                      </Badge>
                    </div>
                  )}
                  {booking.ota_reference && (
                    <div>
                      <p className="text-sm text-muted-foreground">OTA Reference</p>
                      <p className="font-medium">{booking.ota_reference}</p>
                    </div>
                  )}
                  {booking.commission_rate && (
                    <div>
                      <p className="text-sm text-muted-foreground">Commission Rate</p>
                      <p className="font-medium">{booking.commission_rate}%</p>
                    </div>
                  )}
                  {booking.commission_amount && (
                    <div>
                      <p className="text-sm text-muted-foreground">Commission Amount</p>
                      <p className="font-medium text-destructive">
                        - Rs. {Number(booking.commission_amount).toLocaleString()}
                      </p>
                    </div>
                  )}
                  {booking.ota_price !== null && (
                    <div>
                      <p className="text-sm text-muted-foreground">Net Revenue</p>
                      <p className="font-medium text-success">
                        Rs. {Number(booking.ota_price).toLocaleString()}
                      </p>
                    </div>
                  )}
                  {booking.review_reason && (
                    <div className="col-span-2">
                      <p className="text-sm text-muted-foreground">Review Reason</p>
                      <p className="text-sm text-destructive">{booking.review_reason}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

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

            {/* Linked Bookings (Split Stays) */}
            {linkedBookings.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LinkIcon className="h-5 w-5" />
                    Linked Bookings (Split Stay)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {linkedBookings.map((linked) => (
                      <div
                        key={linked.id}
                        className="flex items-center justify-between p-3 bg-muted rounded-lg cursor-pointer hover:bg-muted/80"
                        onClick={() => navigate(`/bookings/${linked.id}`)}
                      >
                        <div>
                          <p className="font-medium">Room {linked.rooms?.room_number}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(linked.check_in), 'PP')} - {format(new Date(linked.check_out), 'PP')}
                          </p>
                        </div>
                        <Badge variant="outline">View</Badge>
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
          <div className="space-y-6">
            {/* Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Booking Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <BookingTimeline booking={booking as any} />
                {isAdmin && (
                  <div className="pt-4 border-t">
                    <AdminStatusOverride
                      bookingId={booking.id}
                      currentStatus={booking.status}
                      onSuccess={fetchBookingDetails}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Billing Summary */}
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
                {fxRate && (
                  <p className="text-xs text-muted-foreground text-right">
                    ~ ${Math.round(grandTotal / fxRate).toLocaleString()} USD
                  </p>
                )}

                {/* OTA Net Revenue Summary */}
                {booking.booking_source && booking.booking_source !== 'direct' && booking.ota_price !== null && (
                  <div className="pt-3 border-t space-y-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">OTA Revenue</p>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Gross Amount</span>
                      <span>Rs. {booking.total_amount.toLocaleString()}</span>
                    </div>
                    {booking.commission_amount && (
                      <div className="flex justify-between text-sm text-destructive">
                        <span>Commission ({booking.commission_rate}%)</span>
                        <span>- Rs. {Number(booking.commission_amount).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-medium text-success">
                      <span>Net Revenue</span>
                      <span>Rs. {Number(booking.ota_price).toLocaleString()}</span>
                    </div>
                  </div>
                )}

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

      {/* Extend Stay Dialog */}
      {booking.rooms && (
        <ExtendStayDialog
          open={showExtendDialog}
          onOpenChange={setShowExtendDialog}
          booking={{
            id: booking.id,
            check_in: booking.check_in,
            check_out: booking.check_out,
            room_id: booking.room_id,
            guest_id: booking.guest_id,
            total_amount: booking.total_amount,
            rooms: booking.rooms,
          }}
          onSuccess={() => {
            fetchBookingDetails();
            fetchLinkedBookings();
          }}
        />
      )}

      {/* Add Service Dialog */}
      <AddServiceDialog
        open={showAddServiceDialog}
        onOpenChange={setShowAddServiceDialog}
        bookingId={booking.id}
        onSuccess={fetchGuestServices}
      />

      {/* Print Preview Dialog */}
      <Dialog open={showPrintPreview} onOpenChange={setShowPrintPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5" />
              Invoice Preview
            </DialogTitle>
            <DialogDescription>
              Review the invoice before printing
            </DialogDescription>
          </DialogHeader>
          
          {booking && booking.rooms && booking.guests && (
            <PrintableInvoice
              ref={printRef}
              data={{
                invoiceNumber: invoiceNumber || `INV-${Date.now()}`,
                invoiceDate: new Date(),
                guest: {
                  name: booking.guests.name,
                  phone: booking.guests.phone,
                  email: booking.guests.email,
                  address: null,
                  id_passport: booking.guests.id_passport,
                },
                room: {
                  room_number: booking.rooms.room_number,
                  room_type: booking.rooms.room_type,
                  price: booking.rooms.price,
                },
                booking: {
                  check_in: booking.check_in,
                  check_out: booking.check_out,
                  num_guests: booking.num_guests,
                  booking_source: booking.booking_source,
                },
                services: services.map((s) => ({
                  name: s.services?.name || 'Service',
                  quantity: s.quantity,
                  unit_price: Number(s.total_price) / s.quantity,
                  total_price: Number(s.total_price),
                  date: s.service_date,
                })),
                roomCharges: booking.total_amount,
                serviceCharges: services.reduce((sum, s) => sum + Number(s.total_price), 0),
                taxRate: 0.1,
                taxAmount: (booking.total_amount + services.reduce((sum, s) => sum + Number(s.total_price), 0)) * 0.1,
                totalAmount: (booking.total_amount + services.reduce((sum, s) => sum + Number(s.total_price), 0)) * 1.1,
              }}
            />
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => {
              setShowPrintPreview(false);
              navigate('/bookings');
            }}>
              Close & Return to Bookings
            </Button>
            <Button onClick={() => handlePrint()}>
              <Printer className="h-4 w-4 mr-2" />
              Print Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

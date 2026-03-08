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
import {
  User, BedDouble, Calendar, CreditCard, ArrowLeft, Printer, Globe, Plus,
  CalendarPlus, Link as LinkIcon, Mail, AlertTriangle, Phone, AtSign,
  Hash, Users, Clock, DollarSign, ShoppingBag, MessageSquare, Sparkles, Star,
} from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { FeedbackDialog } from '@/components/feedback/FeedbackDialog';
import { FeedbackCard } from '@/components/feedback/FeedbackDisplay';
import { useGuestFeedback } from '@/hooks/useGuestFeedback';
import { sendGuestEmail } from '@/lib/guestEmail';

interface BookingDetailsData {
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
  rate_plan_id: string | null;
  discount_code_id: string | null;
  discount_amount: number | null;
  price_breakdown: any | null;
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

// Info row component for consistent icon+label pairs
function InfoRow({ icon: Icon, label, value, className }: { icon: React.ElementType; label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start gap-3 py-2", className)}>
      <div className="p-1.5 rounded-md bg-muted/60 shrink-0 mt-0.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="font-medium text-sm mt-0.5">{value || 'N/A'}</div>
      </div>
    </div>
  );
}

export default function BookingDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin, canWrite } = useAuth();
  const isCheckout = location.pathname.includes('/checkout');

  const [booking, setBooking] = useState<BookingDetailsData | null>(null);
  const [services, setServices] = useState<GuestService[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showCheckoutDialog, setShowCheckoutDialog] = useState(isCheckout);
  const [showExtendDialog, setShowExtendDialog] = useState(false);
  const [showAddServiceDialog, setShowAddServiceDialog] = useState(false);
  const [linkedBookings, setLinkedBookings] = useState<{id: string; check_in: string; check_out: string; rooms: {room_number: string} | null}[]>([]);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const { fxRate } = useFxRate(booking?.property_id);
  const { feedback: bookingFeedback, refetch: refetchFeedback } = useGuestFeedback({
    bookingId: id,
  });

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

  const fetchBookingDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`*, guests (*), rooms (*)`)
        .eq('id', id)
        .single();

      if (error) throw error;
      setBooking(data);

      if (data?.status === 'checked_out') {
        const { data: invoiceData } = await supabase
          .from('invoices')
          .select('invoice_number')
          .eq('booking_id', data.id)
          .maybeSingle();
        if (invoiceData) setInvoiceNumber(invoiceData.invoice_number);
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
        .select(`id, service_date, quantity, total_price, services (name, category)`)
        .eq('booking_id', id);
      setServices(data || []);
    } catch (error) {
      console.error('Error fetching services:', error);
    }
  };

  const fetchLinkedBookings = async () => {
    try {
      const { data: children } = await supabase
        .from('bookings')
        .select('id, check_in, check_out, rooms(room_number)')
        .eq('parent_booking_id', id);

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
      const roomCharges = booking.total_amount;
      const serviceCharges = services.reduce((sum, s) => sum + Number(s.total_price), 0);
      const taxRate = 0.1;
      const taxAmount = (roomCharges + serviceCharges) * taxRate;
      const totalAmount = roomCharges + serviceCharges + taxAmount;

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

      const { error: bookingError } = await supabase
        .from('bookings')
        .update({ status: 'checked_out' })
        .eq('id', booking.id);
      if (bookingError) throw bookingError;

      const cleaningMinutes = 90;
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

      await supabase
        .from('bookings')
        .update({ checked_out_at: new Date().toISOString() })
        .eq('id', booking.id);

      if (booking.property_id) {
        await postBookingConfirmed(booking.id, roomCharges, serviceCharges, taxAmount, booking.property_id, user?.id);
        if (booking.commission_amount && Number(booking.commission_amount) > 0) {
          await postCommission(booking.id, Number(booking.commission_amount), booking.property_id, user?.id);
        }
      }

      setInvoiceNumber(invoice.invoice_number);
      toast.success('Guest checked out successfully. Invoice created.');
      // Send checkout summary email (fire-and-forget)
      sendGuestEmail(booking.id, 'checkout_summary').catch(() => {});
      setShowCheckoutDialog(false);
      setShowPrintPreview(true);
    } catch (error: any) {
      console.error('Error during checkout:', error);
      toast.error(error.message || 'Failed to process checkout');
    } finally {
      setProcessing(false);
    }
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
          <Button variant="link" onClick={() => navigate('/bookings')}>Return to bookings</Button>
        </div>
      </DashboardLayout>
    );
  }

  const nights = differenceInDays(new Date(booking.check_out), new Date(booking.check_in));
  const serviceTotal = services.reduce((sum, s) => sum + Number(s.total_price), 0);
  const taxAmount = (booking.total_amount + serviceTotal) * 0.1;
  const grandTotal = booking.total_amount + serviceTotal + taxAmount;
  const isOta = booking.booking_source && booking.booking_source !== 'direct';

  return (
    <DashboardLayout title="Booking Details">
      <div className="space-y-5">
        {/* Top Bar: Back + Booking ID + Status */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/bookings')}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground font-mono">
                #{booking.id.slice(0, 8)}
              </span>
              <BookingStatusBadge status={booking.status} needsReview={booking.needs_review} />
              {isOta && (
                <Badge variant="outline" className="capitalize text-xs">
                  <Globe className="h-3 w-3 mr-1" />
                  {booking.booking_source.replace('_', '.')}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* LEFT COLUMN (2/3) */}
          <div className="lg:col-span-2 space-y-5">
            {/* Guest Info Card */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-primary/10">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg">{booking.guests?.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">Guest Information</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/guests/${booking.guest_id}`)}
                    className="text-xs"
                  >
                    View Profile
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
                  <InfoRow icon={Phone} label="Phone" value={booking.guests?.phone} />
                  <InfoRow icon={AtSign} label="Email" value={booking.guests?.email} />
                  <InfoRow icon={Hash} label="ID / Passport" value={booking.guests?.id_passport} />
                  <InfoRow icon={Users} label="Guests" value={
                    (booking as any).num_adults
                      ? `${(booking as any).num_adults} Adult${(booking as any).num_adults !== 1 ? 's' : ''}${(booking as any).num_children > 0 ? ` + ${(booking as any).num_children} Child${(booking as any).num_children !== 1 ? 'ren' : ''}` : ''}`
                      : `${booking.num_guests} Guest${booking.num_guests !== 1 ? 's' : ''}`
                  } />
                </div>
              </CardContent>
            </Card>

            {/* Room & Stay Card */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-info/10">
                    <BedDouble className="h-5 w-5 text-info" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Room {booking.rooms?.room_number}</CardTitle>
                    <p className="text-sm text-muted-foreground capitalize">{booking.rooms?.room_type}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
                  <InfoRow icon={Calendar} label="Check-in" value={format(new Date(booking.check_in), 'PPP')} />
                  <InfoRow icon={Calendar} label="Check-out" value={format(new Date(booking.check_out), 'PPP')} />
                  <InfoRow icon={Clock} label="Duration" value={`${nights} night${nights !== 1 ? 's' : ''}`} />
                  <InfoRow icon={DollarSign} label="Rate / Night" value={`Rs. ${booking.rooms?.price.toLocaleString()}`} />
                </div>
              </CardContent>
            </Card>

            {/* OTA Details */}
            {isOta && (
              <Card className={cn(booking.needs_review && "border-destructive/30")}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-warning/10">
                      <Globe className="h-5 w-5 text-warning" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg">OTA Booking Details</CardTitle>
                      <p className="text-sm text-muted-foreground capitalize">{booking.booking_source.replace('_', '.')}</p>
                    </div>
                    {booking.needs_review && (
                      <Badge variant="destructive">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Needs Review
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                    {booking.external_booking_id && (
                      <InfoRow icon={Hash} label="External Booking ID" value={<span className="font-mono text-xs">{booking.external_booking_id}</span>} />
                    )}
                    {booking.external_source && (
                      <InfoRow icon={Globe} label="Source" value={booking.external_source} />
                    )}
                    {booking.imported_via && (
                      <InfoRow icon={Mail} label="Imported Via" value={
                        <Badge variant="outline" className="text-xs mt-0.5">
                          <Mail className="h-3 w-3 mr-1" />{booking.imported_via}
                        </Badge>
                      } />
                    )}
                    {booking.ota_reference && (
                      <InfoRow icon={LinkIcon} label="OTA Reference" value={booking.ota_reference} />
                    )}
                    {booking.commission_rate != null && (
                      <InfoRow icon={DollarSign} label="Commission Rate" value={`${booking.commission_rate}%`} />
                    )}
                    {booking.commission_amount != null && (
                      <InfoRow icon={DollarSign} label="Commission Amount" value={
                        <span className="text-destructive">- Rs. {Number(booking.commission_amount).toLocaleString()}</span>
                      } />
                    )}
                    {booking.ota_price !== null && (
                      <InfoRow icon={Sparkles} label="Net Revenue" value={
                        <span className="text-success">Rs. {Number(booking.ota_price).toLocaleString()}</span>
                      } />
                    )}
                  </div>
                  {booking.review_reason && (
                    <div className="mt-3 p-3 rounded-lg bg-destructive/5 border border-destructive/10">
                      <p className="text-xs text-muted-foreground mb-1">Review Reason</p>
                      <p className="text-sm text-destructive">{booking.review_reason}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Services Used */}
            {services.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-success/10">
                      <ShoppingBag className="h-5 w-5 text-success" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg">Services Used</CardTitle>
                      <p className="text-sm text-muted-foreground">{services.length} service{services.length !== 1 ? 's' : ''}</p>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      Rs. {serviceTotal.toLocaleString()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {services.map((service) => (
                      <div
                        key={service.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors"
                      >
                        <div>
                          <p className="font-medium text-sm">{service.services?.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(service.service_date), 'PP')} × {service.quantity}
                          </p>
                        </div>
                        <p className="font-medium text-sm">
                          Rs. {Number(service.total_price).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Linked Bookings */}
            {linkedBookings.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-accent/40">
                      <LinkIcon className="h-5 w-5 text-foreground" />
                    </div>
                    <CardTitle className="text-lg">Linked Bookings</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {linkedBookings.map((linked) => (
                      <div
                        key={linked.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/40 cursor-pointer hover:bg-muted/60 transition-colors"
                        onClick={() => navigate(`/bookings/${linked.id}`)}
                      >
                        <div>
                          <p className="font-medium text-sm">Room {linked.rooms?.room_number}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(linked.check_in), 'PP')} — {format(new Date(linked.check_out), 'PP')}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs">View</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Special Requests */}
            {booking.special_requests && (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-muted">
                      <MessageSquare className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <CardTitle className="text-lg">Special Requests</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">{booking.special_requests}</p>
                </CardContent>
              </Card>
            )}

            {/* Transactions */}
            <TransactionsTab
              bookingId={booking.id}
              propertyId={booking.property_id}
              totalAmount={grandTotal}
              fxRate={fxRate}
            />
          </div>

          {/* RIGHT COLUMN (1/3) */}
          <div className="space-y-5">
            {/* Timeline */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  Booking Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <BookingTimeline booking={booking as any} />
                {isAdmin && (
                  <div className="pt-4 border-t mt-4">
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
            <Card className="sticky top-20 border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" />
                  Billing Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Room ({nights} nights)</span>
                  <span>Rs. {booking.total_amount.toLocaleString()}</span>
                </div>
                {serviceTotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Services</span>
                    <span>Rs. {serviceTotal.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax (10%)</span>
                  <span>Rs. {taxAmount.toLocaleString()}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-start font-bold text-lg">
                  <span>Total</span>
                  <CurrencyDisplay amount={grandTotal} fxRate={fxRate} size="lg" className="text-right" />
                </div>

                {isOta && booking.ota_price !== null && (
                  <div className="pt-3 border-t space-y-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">OTA Revenue</p>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Gross</span>
                      <span>Rs. {booking.total_amount.toLocaleString()}</span>
                    </div>
                    {booking.commission_amount != null && (
                      <div className="flex justify-between text-sm text-destructive">
                        <span>Commission ({booking.commission_rate}%)</span>
                        <span>- Rs. {Number(booking.commission_amount).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-medium text-success text-sm">
                      <span>Net Revenue</span>
                      <span>Rs. {Number(booking.ota_price).toLocaleString()}</span>
                    </div>
                  </div>
                )}

                {canWrite && booking.status === 'checked_in' && (
                  <Button className="w-full mt-3" onClick={() => setShowCheckoutDialog(true)}>
                    Process Checkout
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Floating Action Bar */}
        {canWrite && (booking.status === 'checked_in' || booking.status === 'confirmed') && (
          <div className="fixed bottom-0 left-0 right-0 z-40 lg:sticky lg:bottom-4">
            <div className="max-w-[1600px] mx-auto px-4 pb-4">
              <Card className="border-primary/20 bg-card/95 backdrop-blur-sm shadow-lg">
                <CardContent className="p-3 flex items-center justify-between gap-3">
                  <div className="text-sm text-muted-foreground hidden sm:block">
                    Quick Actions for <strong>{booking.guests?.name}</strong>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => setShowAddServiceDialog(true)}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Service
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setShowExtendDialog(true)}>
                      <CalendarPlus className="h-4 w-4 mr-1" />
                      Extend Stay
                    </Button>
                    {booking.status === 'checked_in' && (
                      <Button size="sm" onClick={() => setShowCheckoutDialog(true)}>
                        Check Out
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Print invoice button for checked_out (when floating bar isn't showing) */}
        {booking.status === 'checked_out' && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {canWrite && bookingFeedback.length === 0 && (
              <Button variant="outline" onClick={() => setShowFeedbackDialog(true)}>
                <Star className="h-4 w-4 mr-2" />
                Add Feedback
              </Button>
            )}
            {invoiceNumber && (
              <Button variant="outline" onClick={() => setShowPrintPreview(true)}>
                <Printer className="h-4 w-4 mr-2" />
                Print Invoice
              </Button>
            )}
          </div>
        )}

        {/* Feedback Display */}
        {bookingFeedback.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Star className="h-4 w-4 text-warning" />
                Guest Feedback
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FeedbackCard feedback={bookingFeedback[0]} />
            </CardContent>
          </Card>
        )}
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
            <div className="flex justify-between text-sm">
              <span>Room Charges ({nights} nights)</span>
              <span>Rs. {booking.total_amount.toLocaleString()}</span>
            </div>
            {serviceTotal > 0 && (
              <div className="flex justify-between text-sm">
                <span>Services</span>
                <span>Rs. {serviceTotal.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
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
            <Button variant="outline" onClick={() => setShowCheckoutDialog(false)}>Cancel</Button>
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

      {/* Feedback Dialog */}
      {booking.guests && (
        <FeedbackDialog
          open={showFeedbackDialog}
          onOpenChange={setShowFeedbackDialog}
          bookingId={booking.id}
          guestId={booking.guest_id}
          guestName={booking.guests.name}
          propertyId={booking.property_id}
          onSuccess={refetchFeedback}
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
            <DialogDescription>Review the invoice before printing</DialogDescription>
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
            <Button variant="outline" onClick={() => { setShowPrintPreview(false); navigate('/bookings'); }}>
              Close & Return
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

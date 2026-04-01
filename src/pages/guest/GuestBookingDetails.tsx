import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { GuestLayout } from '@/components/guest/GuestLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MapPin, BedDouble, CalendarDays, Users, Plus, UtensilsCrossed } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { GuestAddServiceDialog } from '@/components/guest/GuestAddServiceDialog';

interface GuestService {
  id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  service_date: string;
  notes: string | null;
  service: { name: string; category: string } | null;
}

export default function GuestBookingDetails() {
  const { id } = useParams<{ id: string }>();
  const { guestId } = useAuth();
  const [booking, setBooking] = useState<any>(null);
  const [services, setServices] = useState<GuestService[]>([]);
  const [loading, setLoading] = useState(true);
  const [addServiceOpen, setAddServiceOpen] = useState(false);

  useEffect(() => {
    if (id && guestId) {
      fetchBooking();
      fetchServices();
    }
  }, [id, guestId]);

  const fetchBooking = async () => {
    const { data } = await supabase
      .from('bookings')
      .select(`
        *,
        room:rooms(room_number, room_type, description),
        property:properties(name, location, address),
        rate_plan:rate_plans(name, is_refundable)
      `)
      .eq('id', id!)
      .eq('guest_id', guestId!)
      .single();

    if (data) {
      setBooking({
        ...data,
        room: Array.isArray(data.room) ? data.room[0] : data.room,
        property: Array.isArray(data.property) ? data.property[0] : data.property,
        rate_plan: Array.isArray(data.rate_plan) ? data.rate_plan[0] : data.rate_plan,
      });
    }
    setLoading(false);
  };

  const fetchServices = async () => {
    const { data } = await supabase
      .from('guest_services')
      .select('id, quantity, unit_price, total_price, service_date, notes, service:services(name, category)')
      .eq('booking_id', id!)
      .order('created_at', { ascending: false });

    if (data) {
      setServices(
        data.map((s: any) => ({
          ...s,
          service: Array.isArray(s.service) ? s.service[0] : s.service,
        }))
      );
    }
  };

  const canAddService = booking && ['confirmed', 'checked_in'].includes(booking.status);
  const servicesTotalAmount = services.reduce((sum, s) => sum + s.total_price, 0);

  if (loading) {
    return (
      <GuestLayout title="Booking Details">
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </GuestLayout>
    );
  }

  if (!booking) {
    return (
      <GuestLayout title="Booking Not Found">
        <p className="text-muted-foreground">This booking could not be found.</p>
        <Button variant="outline" asChild className="mt-4">
          <Link to="/guest/dashboard"><ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard</Link>
        </Button>
      </GuestLayout>
    );
  }

  const nights = differenceInDays(parseISO(booking.check_out), parseISO(booking.check_in));

  return (
    <GuestLayout title="Booking Details">
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link to="/guest/dashboard"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link>
      </Button>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Stay Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              Stay Details
              <Badge variant={booking.status === 'confirmed' ? 'default' : 'secondary'}>
                {booking.status.replace('_', ' ')}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span>{format(parseISO(booking.check_in), 'EEEE, MMM d, yyyy')} → {format(parseISO(booking.check_out), 'EEEE, MMM d, yyyy')}</span>
            </div>
            <div className="flex items-center gap-2">
              <BedDouble className="h-4 w-4 text-muted-foreground" />
              <span>Room {booking.room?.room_number} ({booking.room?.room_type}) • {nights} night{nights !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>{booking.num_adults} adult{booking.num_adults !== 1 ? 's' : ''}{booking.num_children > 0 ? `, ${booking.num_children} child${booking.num_children !== 1 ? 'ren' : ''}` : ''}</span>
            </div>
            {booking.property && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{booking.property.name}{booking.property.location ? ` – ${booking.property.location}` : ''}</span>
              </div>
            )}
            {booking.special_requests && (
              <div className="pt-2 border-t border-border">
                <p className="text-muted-foreground text-xs mb-1">Special Requests</p>
                <p>{booking.special_requests}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pricing */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pricing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {booking.rate_plan && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rate Plan</span>
                <span>{booking.rate_plan.name}{booking.rate_plan.is_refundable ? ' (Refundable)' : ' (Non-refundable)'}</span>
              </div>
            )}
            {booking.discount_amount > 0 && (
              <div className="flex justify-between text-success">
                <span>Discount</span>
                <span>-LKR {booking.discount_amount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-base pt-2 border-t border-border">
              <span>Room Total</span>
              <span>LKR {(booking.total_amount || 0).toLocaleString()}</span>
            </div>
            {servicesTotalAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Services</span>
                <span>LKR {servicesTotalAmount.toLocaleString()}</span>
              </div>
            )}
            {servicesTotalAmount > 0 && (
              <div className="flex justify-between font-semibold text-base pt-2 border-t border-border">
                <span>Grand Total</span>
                <span>LKR {((booking.total_amount || 0) + servicesTotalAmount).toLocaleString()}</span>
              </div>
            )}
            {booking.price_breakdown && (
              <details className="pt-2">
                <summary className="text-xs text-muted-foreground cursor-pointer">View nightly breakdown</summary>
                <div className="mt-2 space-y-1">
                  {(booking.price_breakdown as any)?.nightlyRates?.map((n: any, i: number) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span>{n.date}</span>
                      <span>LKR {n.finalRate?.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </CardContent>
        </Card>

        {/* Services */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span className="flex items-center gap-2">
                <UtensilsCrossed className="h-5 w-5" />
                Services
              </span>
              {canAddService && (
                <Button size="sm" onClick={() => setAddServiceOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Add Service
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {services.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {canAddService
                  ? 'No services added yet. You can request room service, transport, and more.'
                  : 'No services were added to this booking.'}
              </p>
            ) : (
              <div className="space-y-2">
                {services.map((s) => (
                  <div key={s.id} className="flex items-center justify-between p-3 bg-muted rounded-lg text-sm">
                    <div>
                      <p className="font-medium">{s.service?.name || 'Service'}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.quantity} × LKR {s.unit_price.toLocaleString()} • {s.service_date}
                      </p>
                    </div>
                    <span className="font-medium">LKR {s.total_price.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <GuestAddServiceDialog
        open={addServiceOpen}
        onOpenChange={setAddServiceOpen}
        bookingId={id!}
        onSuccess={fetchServices}
      />
    </GuestLayout>
  );
}

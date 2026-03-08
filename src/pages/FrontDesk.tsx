import { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/front-desk/StatCard';
import { SectionHeader } from '@/components/front-desk/SectionHeader';
import { BookingCard, type FrontDeskBooking } from '@/components/front-desk/BookingCard';
import { PaymentDialog } from '@/components/front-desk/PaymentDialog';
import { PropertyBadge } from '@/components/layout/PropertyBadge';
import { supabase } from '@/integrations/supabase/client';
import { useProperty } from '@/hooks/useProperty';
import { useAuth } from '@/hooks/useAuth';
import { toDateString, parseLocalDate } from '@/lib/dateUtils';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
  LogOut,
  Plane,
  Hotel,
  CreditCard,
  RefreshCw,
  Plus,
  Clock,
  Banknote,
} from 'lucide-react';

interface PendingPaymentBooking {
  id: string;
  check_in: string;
  check_out: string;
  status: string;
  total_amount: number | null;
  room_id: string;
  guests: { name: string } | null;
  rooms: { room_number: string } | null;
  invoices: { id: string; total_amount: number; payment_status: string }[];
}

export default function FrontDesk() {
  const navigate = useNavigate();
  const { selectedProperty, showAllProperties } = useProperty();
  const { canWrite } = useAuth();
  const [arrivals, setArrivals] = useState<FrontDeskBooking[]>([]);
  const [inHouse, setInHouse] = useState<FrontDeskBooking[]>([]);
  const [departures, setDepartures] = useState<FrontDeskBooking[]>([]);
  const [pendingPayments, setPendingPayments] = useState<PendingPaymentBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paymentBooking, setPaymentBooking] = useState<PendingPaymentBooking | null>(null);

  const today = toDateString(new Date());

  const fetchAll = useCallback(async () => {
    try {
      const propertyFilter =
        !showAllProperties && selectedProperty?.id ? selectedProperty.id : null;

      const baseSelect = `
        id, check_in, check_out, status, num_guests, total_amount,
        room_id, property_id, booking_source,
        guests (name, phone),
        rooms (room_number, room_type)
      `;

      let arrivalsQ = supabase
        .from('bookings')
        .select(baseSelect)
        .eq('check_in', today)
        .in('status', ['confirmed', 'pending'])
        .order('created_at', { ascending: false });
      if (propertyFilter) arrivalsQ = arrivalsQ.eq('property_id', propertyFilter);

      let inHouseQ = supabase
        .from('bookings')
        .select(baseSelect)
        .eq('status', 'checked_in')
        .order('check_out', { ascending: true });
      if (propertyFilter) inHouseQ = inHouseQ.eq('property_id', propertyFilter);

      let departuresQ = supabase
        .from('bookings')
        .select(baseSelect)
        .eq('check_out', today)
        .eq('status', 'checked_in')
        .order('created_at', { ascending: false });
      if (propertyFilter) departuresQ = departuresQ.eq('property_id', propertyFilter);

      let paymentsQ = supabase
        .from('bookings')
        .select(
          `id, check_in, check_out, status, total_amount, room_id,
          guests (name),
          rooms (room_number),
          invoices (id, total_amount, payment_status)`
        )
        .in('status', ['checked_in', 'checked_out'])
        .order('check_out', { ascending: true });
      if (propertyFilter) paymentsQ = paymentsQ.eq('property_id', propertyFilter);

      const [arrivalsRes, inHouseRes, departuresRes, paymentsRes] = await Promise.all([
        arrivalsQ,
        inHouseQ,
        departuresQ,
        paymentsQ,
      ]);

      if (arrivalsRes.error) throw arrivalsRes.error;
      if (inHouseRes.error) throw inHouseRes.error;
      if (departuresRes.error) throw departuresRes.error;
      if (paymentsRes.error) throw paymentsRes.error;

      setArrivals((arrivalsRes.data as FrontDeskBooking[]) || []);
      setInHouse((inHouseRes.data as FrontDeskBooking[]) || []);
      setDepartures((departuresRes.data as FrontDeskBooking[]) || []);

      const unpaid = (paymentsRes.data || []).filter((b: any) =>
        b.invoices?.some((inv: any) => inv.payment_status !== 'paid')
      );
      setPendingPayments(unpaid as PendingPaymentBooking[]);
    } catch (error) {
      console.error('Error fetching front desk data:', error);
      toast.error('Failed to load front desk data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedProperty, showAllProperties, today]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('front-desk-bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        fetchAll();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAll();
  };

  const nightsRemaining = (checkOut: string) => {
    const co = parseLocalDate(checkOut);
    const now = new Date();
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = Math.ceil((co.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };

  const SectionSkeleton = () => (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border p-3 space-y-2">
          <div className="flex items-start justify-between">
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="flex gap-1">
            <Skeleton className="h-7 w-7 rounded" />
            <Skeleton className="h-7 w-16 rounded" />
            <Skeleton className="h-7 w-16 rounded" />
          </div>
        </div>
      ))}
    </div>
  );

  const EmptyState = ({ message }: { message: string }) => (
    <div className="py-8 text-center text-muted-foreground text-sm">{message}</div>
  );

  return (
    <DashboardLayout title="Front Desk">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Viewing:</span>
            <PropertyBadge />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {canWrite && (
              <Button size="sm" onClick={() => navigate('/bookings/new')}>
                <Plus className="h-4 w-4 mr-1" />
                New Booking
              </Button>
            )}
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Plane} label="Today Arrivals" count={arrivals.length} color="text-success" />
          <StatCard icon={Hotel} label="In-House" count={inHouse.length} color="text-info" />
          <StatCard icon={LogOut} label="Departures" count={departures.length} color="text-warning" />
          <StatCard icon={CreditCard} label="Pending Pay" count={pendingPayments.length} color="text-destructive" />
        </div>

        {/* Sections Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Today Arrivals */}
          <Card className="border-t-[3px] border-t-success">
            <CardHeader className="pb-3">
              <SectionHeader icon={Plane} title="Today Arrivals" count={arrivals.length} color="text-success" />
            </CardHeader>
            <CardContent className="space-y-2">
              {loading ? (
                <SectionSkeleton />
              ) : arrivals.length === 0 ? (
                <EmptyState message="No arrivals today" />
              ) : (
                arrivals.map((b) => (
                  <BookingCard
                    key={b.id}
                    booking={b}
                    onActionComplete={fetchAll}
                    badge={
                      <Badge variant="outline" className="text-xs">
                        {b.booking_source.replace('_', '.')}
                      </Badge>
                    }
                  />
                ))
              )}
            </CardContent>
          </Card>

          {/* Today Departures */}
          <Card className="border-t-[3px] border-t-warning">
            <CardHeader className="pb-3">
              <SectionHeader icon={LogOut} title="Today Departures" count={departures.length} color="text-warning" />
            </CardHeader>
            <CardContent className="space-y-2">
              {loading ? (
                <SectionSkeleton />
              ) : departures.length === 0 ? (
                <EmptyState message="No departures today" />
              ) : (
                departures.map((b) => (
                  <BookingCard
                    key={b.id}
                    booking={b}
                    onActionComplete={fetchAll}
                    badge={
                      <Badge variant="outline" className="text-xs flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Due Out
                      </Badge>
                    }
                  />
                ))
              )}
            </CardContent>
          </Card>

          {/* In-House Guests */}
          <Card className="border-t-[3px] border-t-info">
            <CardHeader className="pb-3">
              <SectionHeader icon={Hotel} title="In-House Guests" count={inHouse.length} color="text-info" />
            </CardHeader>
            <CardContent className="space-y-2">
              {loading ? (
                <SectionSkeleton />
              ) : inHouse.length === 0 ? (
                <EmptyState message="No guests currently checked in" />
              ) : (
                inHouse.map((b) => {
                  const nights = nightsRemaining(b.check_out);
                  return (
                    <BookingCard
                      key={b.id}
                      booking={b}
                      onActionComplete={fetchAll}
                      badge={
                        <Badge variant="outline" className="text-xs">
                          {nights === 0
                            ? 'Due today'
                            : `${nights} night${nights > 1 ? 's' : ''} left`}
                        </Badge>
                      }
                    />
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Pending Payments */}
          <Card>
            <CardHeader className="pb-3">
              <SectionHeader icon={CreditCard} title="Pending Payments" count={pendingPayments.length} color="text-rose-500" />
            </CardHeader>
            <CardContent className="space-y-2">
              {loading ? (
                <SectionSkeleton />
              ) : pendingPayments.length === 0 ? (
                <EmptyState message="No pending payments" />
              ) : (
                pendingPayments.map((b) => {
                  const unpaidInvoices =
                    b.invoices?.filter((inv) => inv.payment_status !== 'paid') || [];
                  const unpaidTotal = unpaidInvoices.reduce(
                    (sum, inv) => sum + Number(inv.total_amount),
                    0
                  );
                  return (
                    <div
                      key={b.id}
                      className="flex items-center justify-between rounded-xl border p-3 hover:bg-muted/30 transition-colors"
                    >
                      <div
                        className="min-w-0 cursor-pointer flex-1"
                        onClick={() => navigate(`/bookings/${b.id}`)}
                      >
                        <p className="text-sm font-medium truncate">
                          {b.guests?.name || 'Unknown Guest'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Room {b.rooms?.room_number || '—'} · {unpaidInvoices.length} invoice
                          {unpaidInvoices.length > 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <div className="text-right">
                          <p className="text-sm font-semibold text-destructive">
                            LKR {unpaidTotal.toLocaleString()}
                          </p>
                          <Badge variant="destructive" className="text-[10px]">
                            {unpaidInvoices[0]?.payment_status === 'partial' ? 'Partial' : 'Unpaid'}
                          </Badge>
                        </div>
                        {canWrite && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setPaymentBooking(b)}
                          >
                            <Banknote className="h-3.5 w-3.5 mr-1" />
                            Pay
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Payment Dialog */}
      {paymentBooking && (
        <PaymentDialog
          open={!!paymentBooking}
          onOpenChange={(open) => !open && setPaymentBooking(null)}
          booking={paymentBooking}
          onSuccess={fetchAll}
        />
      )}
    </DashboardLayout>
  );
}

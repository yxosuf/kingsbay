import { useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toDateString } from '@/lib/dateUtils';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useUserSettings } from '@/hooks/useUserSettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { 
  Eye, LogIn, LogOut, CalendarCheck, Sun, AlertTriangle, TrendingUp, TrendingDown,
} from 'lucide-react';
import { DashboardAvailabilityCalendar } from '@/components/dashboard/DashboardAvailabilityCalendar';
import { RecentFeedbackWidget } from '@/components/dashboard/RecentFeedbackWidget';
import { OperationsMetricsRow } from '@/components/dashboard/OperationsMetricsRow';
import { RevenueMetricsCard } from '@/components/dashboard/RevenueMetricsCard';
import { BookingSourcesChart } from '@/components/dashboard/BookingSourcesChart';
import { OtaPerformanceCard } from '@/components/dashboard/OtaPerformanceCard';
import { AiSuggestionsPanel } from '@/components/dashboard/AiSuggestionsPanel';
import { useDashboardKpi, emptyKpi, emptyRevenue, emptyRooms } from '@/hooks/useDashboardKpi';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useProperty } from '@/hooks/useProperty';
import { PropertyBadge } from '@/components/layout/PropertyBadge';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface ActivityItem {
  id: string;
  guest_name: string;
  room_number: string;
  type: 'check_in' | 'check_out';
  status: string;
  time: string;
}

interface ExchangeRate {
  usdToLkr: number;
  updatedAt: string | null;
  previousRate: number | null;
  isStale: boolean;
}

async function fetchActivityData(propertyId: string | null, showAll: boolean) {
  const propertyFilter = !showAll && propertyId;
  const today = toDateString(new Date());

  let checkInsQ = supabase.from('bookings').select('id, status, check_in, property_id, guests (name), rooms (room_number)').eq('check_in', today).in('status', ['pending', 'confirmed', 'checked_in']);
  let checkOutsQ = supabase.from('bookings').select('id, status, check_out, property_id, guests (name), rooms (room_number)').eq('check_out', today).in('status', ['checked_in', 'checked_out']);

  if (propertyFilter) {
    checkInsQ = checkInsQ.eq('property_id', propertyId);
    checkOutsQ = checkOutsQ.eq('property_id', propertyId);
  }

  const [{ data: checkIns }, { data: checkOuts }] = await Promise.all([checkInsQ, checkOutsQ]);

  const activity: ActivityItem[] = [
    ...(checkIns?.map((b: any) => ({
      id: b.id,
      guest_name: b.guests?.name || 'Unknown',
      room_number: b.rooms?.room_number || 'N/A',
      type: 'check_in' as const,
      status: b.status,
      time: b.check_in,
    })) || []),
    ...(checkOuts?.map((b: any) => ({
      id: b.id,
      guest_name: b.guests?.name || 'Unknown',
      room_number: b.rooms?.room_number || 'N/A',
      type: 'check_out' as const,
      status: b.status,
      time: b.check_out,
    })) || []),
  ];

  return activity;
}

async function fetchExchangeRateData(propertyId: string | null): Promise<ExchangeRate> {
  if (propertyId) {
    const { data } = await supabase
      .from('property_inventory_settings')
      .select('fx_usd_lkr_rate, fx_updated_at')
      .eq('property_id', propertyId)
      .maybeSingle();
    const rate = (data as any)?.fx_usd_lkr_rate;
    const updatedAt = (data as any)?.fx_updated_at;
    if (rate) {
      const currentRate = Number(rate);
      const isStale = updatedAt 
        ? (Date.now() - new Date(updatedAt).getTime()) > 2 * 60 * 60 * 1000 
        : true;
      return { usdToLkr: currentRate, updatedAt: updatedAt || null, previousRate: null, isStale };
    }
  }
  return { usdToLkr: 309.06, updatedAt: null, previousRate: null, isStale: false };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { selectedProperty, showAllProperties } = useProperty();
  const { canWrite } = useAuth();
  const { settings, loading: settingsLoading } = useUserSettings();
  const redirectChecked = useRef(false);
  const propertyId = selectedProperty?.id ?? null;

  useEffect(() => {
    if (!settingsLoading && !redirectChecked.current) {
      redirectChecked.current = true;
      const landing = settings.default_landing_page;
      if (landing && landing !== '/') {
        navigate(landing, { replace: true });
      }
    }
  }, [settingsLoading, settings.default_landing_page, navigate]);

  // KPI data from database views
  const { data: kpiData, isPlaceholderData } = useDashboardKpi();
  const kpi = kpiData?.kpi;
  const revenue = kpiData?.revenue;
  const rooms = kpiData?.rooms;

  // Activity feed + Exchange rate in parallel
  const { data: todayActivity = [], isLoading: loading } = useQuery({
    queryKey: ['dashboard-activity', propertyId, showAllProperties],
    queryFn: () => fetchActivityData(propertyId, showAllProperties),
    staleTime: 2 * 60 * 1000,
  });

  const { data: exchangeRate } = useQuery({
    queryKey: ['exchangeRate', propertyId],
    queryFn: () => fetchExchangeRateData(propertyId),
    staleTime: 5 * 60 * 1000,
  });

  const weather = useMemo(() => ({
    temperature: 29.1,
    location: 'Colombo, Sri Lanka',
    condition: 'Partly Cloudy',
  }), []);

  const handleCheckIn = useCallback(async (bookingId: string) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'checked_in', checked_in_at: new Date().toISOString() })
        .eq('id', bookingId);
      if (error) throw error;
      toast.success('Guest checked in successfully');
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpi'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-activity'] });
    } catch {
      toast.error('Failed to check in guest');
    }
  }, [queryClient]);

  const handleCheckOut = useCallback((bookingId: string) => {
    navigate(`/bookings/${bookingId}/checkout`);
  }, [navigate]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info' }> = {
      pending: { variant: 'warning' },
      confirmed: { variant: 'info' },
      checked_in: { variant: 'success' },
      checked_out: { variant: 'secondary' },
      cancelled: { variant: 'destructive' },
    };
    const config = variants[status] || variants.pending;
    return <Badge variant={config.variant}>{status.replace('_', ' ')}</Badge>;
  };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  })();

  const fxRate = exchangeRate?.usdToLkr ?? null;

  return (
    <DashboardLayout title="Dashboard">
      <div className="space-y-5 sm:space-y-6">
        {/* Header with greeting */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">{greeting}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Here's what's happening today</p>
          </div>
          <PropertyBadge />
        </div>

        {/* Operations Metrics Row — 6 KPI cards */}
        <OperationsMetricsRow kpi={kpi ?? emptyKpi} rooms={rooms ?? emptyRooms} />

        {/* Revenue + Booking Sources + OTA Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          <RevenueMetricsCard revenue={revenue ?? emptyRevenue} rooms={rooms ?? emptyRooms} fxRate={fxRate} />
          <BookingSourcesChart kpi={kpi ?? emptyKpi} />
          <OtaPerformanceCard kpi={kpi ?? emptyKpi} fxRate={fxRate} />
        </div>

        {/* AI Suggestions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <AiSuggestionsPanel
            type="occupancy_forecast"
            context={{
              occupancyPercent: (rooms?.total_rooms ?? 0) > 0 ? Math.round(((kpi?.rooms_occupied ?? 0) / (rooms?.total_rooms ?? 1)) * 100) : 0,
              totalRooms: rooms?.total_rooms ?? 0,
              upcomingBookings: kpi?.arrivals_today ?? 0,
              upcomingBookings30: (kpi?.direct_bookings_month ?? 0) + (kpi?.ota_bookings_month ?? 0),
            }}
          />
          <AiSuggestionsPanel
            type="cross_sell"
            context={{
              nights: 2,
              roomType: 'standard',
              totalSpend: revenue?.revenue_month || 0,
              isVip: false,
            }}
          />
        </div>
        {/* Main Content Grid - Activity + Widgets */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Today's Activity */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-3 sm:pb-6">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <CalendarCheck className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                Today's Activity
              </CardTitle>
              <Button 
                variant="link" 
                className="text-primary text-sm px-0"
                onClick={() => navigate('/bookings')}
              >
                View All
              </Button>
            </CardHeader>
            <CardContent className="px-3 sm:px-6">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : todayActivity.length === 0 ? (
                <div className="text-center py-10">
                  <div className="mx-auto w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center mb-3">
                    <CalendarCheck className="h-6 w-6 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">No activity today</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Check-ins and check-outs will appear here</p>
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-0">
                  {/* Mobile view */}
                  <div className="sm:hidden space-y-3">
                    {todayActivity.map((activity) => (
                      <Card key={`${activity.id}-${activity.type}`} className="border-border/50 hover:shadow-sm">
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div className={cn(
                                "p-1.5 rounded-full shrink-0",
                                activity.type === 'check_in' ? 'bg-success/15' : 'bg-warning/15'
                              )}>
                                {activity.type === 'check_in' ? (
                                  <LogIn className="h-3.5 w-3.5 text-success" />
                                ) : (
                                  <LogOut className="h-3.5 w-3.5 text-warning" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium truncate">{activity.guest_name}</p>
                                <p className="text-sm text-muted-foreground">Room {activity.room_number}</p>
                              </div>
                            </div>
                            <Badge variant={activity.type === 'check_in' ? 'success' : 'warning'}>
                              {activity.type === 'check_in' ? 'Arrival' : 'Departure'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-3 pt-2 border-t">
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="flex-1"
                              onClick={() => navigate(`/bookings/${activity.id}`)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                            {canWrite && activity.type === 'check_in' && (activity.status === 'pending' || activity.status === 'confirmed') && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="text-success border-success"
                                onClick={() => handleCheckIn(activity.id)}
                              >
                                <LogIn className="h-4 w-4" />
                              </Button>
                            )}
                            {canWrite && activity.type === 'check_out' && activity.status === 'checked_in' && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="text-warning border-warning"
                                onClick={() => handleCheckOut(activity.id)}
                              >
                                <LogOut className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  
                  {/* Desktop view */}
                  <Table className="hidden sm:table">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Guest</TableHead>
                        <TableHead>Room</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {todayActivity.map((activity) => (
                        <TableRow 
                          key={`${activity.id}-${activity.type}`}
                          className={cn(
                            "transition-colors",
                            activity.type === 'check_in' 
                              ? "hover:bg-success/5 border-l-2 border-l-transparent hover:border-l-success" 
                              : "hover:bg-warning/5 border-l-2 border-l-transparent hover:border-l-warning"
                          )}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className={cn(
                                "p-1.5 rounded-full",
                                activity.type === 'check_in' ? 'bg-success/15' : 'bg-warning/15'
                              )}>
                                {activity.type === 'check_in' ? (
                                  <LogIn className="h-4 w-4 text-success" />
                                ) : (
                                  <LogOut className="h-4 w-4 text-warning" />
                                )}
                              </div>
                              <span className="font-medium">
                                {activity.type === 'check_in' ? 'Check-in' : 'Check-out'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{activity.guest_name}</TableCell>
                          <TableCell>Room {activity.room_number}</TableCell>
                          <TableCell>{getStatusBadge(activity.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => navigate(`/bookings/${activity.id}`)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {canWrite && activity.type === 'check_in' && (activity.status === 'pending' || activity.status === 'confirmed') && (
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  className="text-success"
                                  onClick={() => handleCheckIn(activity.id)}
                                >
                                  <LogIn className="h-4 w-4" />
                                </Button>
                              )}
                              {canWrite && activity.type === 'check_out' && activity.status === 'checked_in' && (
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  className="text-warning"
                                  onClick={() => handleCheckOut(activity.id)}
                                >
                                  <LogOut className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Side Widgets */}
          <div className="grid grid-cols-2 lg:grid-cols-1 gap-3 sm:gap-4">
            {/* Weather Widget */}
            <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-0 overflow-hidden relative">
              <CardContent className="p-4 sm:p-6 relative z-10">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm opacity-70 font-medium">Weather</p>
                    <p className="text-2xl sm:text-3xl font-bold mt-1">
                      {weather?.temperature || '--'}°C
                    </p>
                    <p className="text-xs sm:text-sm opacity-70 truncate mt-1">{weather?.condition}</p>
                    <p className="text-[10px] sm:text-xs opacity-50 truncate">{weather?.location}</p>
                  </div>
                  <Sun className="h-10 w-10 sm:h-14 sm:w-14 opacity-30 shrink-0" />
                </div>
              </CardContent>
              <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-primary-foreground/5" />
            </Card>

            {/* Exchange Rate Widget */}
            <Card className={cn("overflow-hidden", exchangeRate?.isStale && "border-warning/50")}>
              <CardContent className="p-4 sm:p-6">
                {exchangeRate?.isStale && (
                  <div className="flex items-center gap-1.5 mb-2 text-warning">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span className="text-[10px] sm:text-xs font-medium">Rate is stale</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-muted-foreground font-medium">USD → LKR</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xl sm:text-2xl font-bold text-foreground">
                        Rs. {exchangeRate?.usdToLkr?.toFixed(2) || '--'}
                      </p>
                      {exchangeRate?.previousRate != null && exchangeRate.previousRate !== exchangeRate.usdToLkr && (
                        <div className={cn(
                          "flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full",
                          exchangeRate.usdToLkr > exchangeRate.previousRate 
                            ? "text-success bg-success/10" 
                            : "text-destructive bg-destructive/10"
                        )}>
                          {exchangeRate.usdToLkr > exchangeRate.previousRate ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          <span>{Math.abs(exchangeRate.usdToLkr - exchangeRate.previousRate).toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                    {exchangeRate?.updatedAt ? (
                      <p className={cn(
                        "text-[10px] sm:text-xs mt-1",
                        exchangeRate.isStale ? "text-warning" : "text-muted-foreground/70"
                      )}>
                        Updated {(() => {
                          const mins = Math.round((Date.now() - new Date(exchangeRate.updatedAt).getTime()) / 60000);
                          if (mins < 1) return 'just now';
                          if (mins < 60) return `${mins} min ago`;
                          const hrs = Math.round(mins / 60);
                          if (hrs < 24) return `${hrs}h ago`;
                          return `${Math.round(hrs / 24)}d ago`;
                        })()}
                      </p>
                    ) : (
                      <p className="text-[10px] sm:text-xs text-muted-foreground/70 hidden sm:block mt-1">Auto-updates hourly</p>
                    )}
                  </div>
                  <div className={cn(
                    "p-2.5 sm:p-3 rounded-xl shrink-0",
                    exchangeRate?.isStale ? "bg-warning/10" : "bg-success/10"
                  )}>
                    {exchangeRate?.isStale ? (
                      <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-warning" />
                    ) : (
                      <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-success" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Feedback & Calendar Widgets */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <RecentFeedbackWidget />
          <DashboardAvailabilityCalendar />
        </div>
      </div>
    </DashboardLayout>
  );
}

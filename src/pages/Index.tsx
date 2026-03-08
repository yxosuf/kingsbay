import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toDateString } from '@/lib/dateUtils';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Users, 
  Wallet, 
  Clock, 
  BedDouble, 
  Eye, 
  LogIn, 
  LogOut,
  Cloud,
  TrendingUp,
  CalendarCheck,
  Sun,
} from 'lucide-react';
import { DashboardAvailabilityCalendar } from '@/components/dashboard/DashboardAvailabilityCalendar';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useProperty } from '@/hooks/useProperty';
import { PropertyBadge } from '@/components/layout/PropertyBadge';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface DashboardStats {
  activeGuests: number;
  totalRevenue: number;
  arrivalsToday: number;
  availableRooms: number;
}

interface ActivityItem {
  id: string;
  guest_name: string;
  room_number: string;
  type: 'check_in' | 'check_out';
  status: string;
  time: string;
}

interface WeatherData {
  temperature: number;
  location: string;
  condition: string;
}

interface ExchangeRate {
  usdToLkr: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { selectedProperty, showAllProperties, properties } = useProperty();
  const { canWrite } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    activeGuests: 0,
    totalRevenue: 0,
    arrivalsToday: 0,
    availableRooms: 0,
  });
  const [todayActivity, setTodayActivity] = useState<ActivityItem[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [exchangeRate, setExchangeRate] = useState<ExchangeRate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
    fetchWeather();
    fetchExchangeRate();
  }, [selectedProperty, showAllProperties]);

  const fetchDashboardData = async () => {
    try {
      const propertyFilter = !showAllProperties && selectedProperty?.id;
      
      let activeGuestsQuery = supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'checked_in');
      if (propertyFilter) activeGuestsQuery = activeGuestsQuery.eq('property_id', selectedProperty.id);
      const { count: activeGuests } = await activeGuestsQuery;

      const today = toDateString(new Date());
      let arrivalsQuery = supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('check_in', today)
        .in('status', ['pending', 'confirmed']);
      if (propertyFilter) arrivalsQuery = arrivalsQuery.eq('property_id', selectedProperty.id);
      const { count: arrivalsToday } = await arrivalsQuery;

      let totalRoomsQuery = supabase
        .from('rooms')
        .select('id')
        .neq('status', 'maintenance');
      if (propertyFilter) totalRoomsQuery = totalRoomsQuery.eq('property_id', selectedProperty.id);
      const { data: allRooms } = await totalRoomsQuery;
      const totalRoomCount = allRooms?.length || 0;

      let blockedQuery = supabase
        .from('bookings')
        .select('room_id')
        .in('status', ['confirmed', 'checked_in', 'pending', 'needs_review'])
        .lte('check_in', today)
        .gt('check_out', today);
      if (propertyFilter) blockedQuery = blockedQuery.eq('property_id', selectedProperty.id);
      const { data: blockedBookings } = await blockedQuery;
      const blockedRoomIds = new Set(blockedBookings?.map(b => b.room_id) || []);
      const availableRooms = totalRoomCount - blockedRoomIds.size;

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      let invoicesQuery = supabase
        .from('invoices')
        .select('total_amount, property_id')
        .gte('created_at', startOfMonth.toISOString());
      if (propertyFilter) invoicesQuery = invoicesQuery.eq('property_id', selectedProperty.id);
      const { data: invoices } = await invoicesQuery;
      
      const totalRevenue = invoices?.reduce((sum, i) => sum + Number(i.total_amount), 0) || 0;

      let checkInsQuery = supabase
        .from('bookings')
        .select(`
          id,
          status,
          check_in,
          property_id,
          guests (name),
          rooms (room_number)
        `)
        .eq('check_in', today)
        .in('status', ['pending', 'confirmed', 'checked_in']);
      if (propertyFilter) checkInsQuery = checkInsQuery.eq('property_id', selectedProperty.id);
      const { data: checkIns } = await checkInsQuery;

      let checkOutsQuery = supabase
        .from('bookings')
        .select(`
          id,
          status,
          check_out,
          property_id,
          guests (name),
          rooms (room_number)
        `)
        .eq('check_out', today)
        .in('status', ['checked_in', 'checked_out']);
      if (propertyFilter) checkOutsQuery = checkOutsQuery.eq('property_id', selectedProperty.id);
      const { data: checkOuts } = await checkOutsQuery;

      setStats({
        activeGuests: activeGuests || 0,
        totalRevenue,
        arrivalsToday: arrivalsToday || 0,
        availableRooms: availableRooms || 0,
      });

      const activityItems: ActivityItem[] = [
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

      setTodayActivity(activityItems);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWeather = async () => {
    setWeather({
      temperature: 29.1,
      location: 'Colombo, Sri Lanka',
      condition: 'Partly Cloudy',
    });
  };

  const fetchExchangeRate = async () => {
    try {
      const propertyId = selectedProperty?.id;
      if (propertyId) {
        const { data } = await supabase
          .from('property_inventory_settings')
          .select('*')
          .eq('property_id', propertyId)
          .maybeSingle();
        const rate = (data as any)?.fx_usd_lkr_rate;
        if (rate) {
          setExchangeRate({ usdToLkr: Number(rate) });
          return;
        }
      }
      setExchangeRate({ usdToLkr: 309.06 });
    } catch {
      setExchangeRate({ usdToLkr: 309.06 });
    }
  };

  const handleCheckIn = async (bookingId: string) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'checked_in' })
        .eq('id', bookingId);

      if (error) throw error;
      
      toast.success('Guest checked in successfully');
      fetchDashboardData();
    } catch (error) {
      toast.error('Failed to check in guest');
    }
  };

  const handleCheckOut = async (bookingId: string) => {
    navigate(`/bookings/${bookingId}/checkout`);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info'; className?: string }> = {
      pending: { variant: 'warning' },
      confirmed: { variant: 'info' },
      checked_in: { variant: 'success' },
      checked_out: { variant: 'secondary' },
      cancelled: { variant: 'destructive' },
    };
    
    const config = variants[status] || variants.pending;
    
    return (
      <Badge variant={config.variant} className={config.className}>
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const statCards = [
    {
      title: 'Active Guests',
      value: stats.activeGuests.toString(),
      icon: Users,
      onClick: () => navigate('/guests?filter=active'),
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      borderColor: 'border-l-primary',
    },
    {
      title: 'Total Revenue',
      value: `Rs. ${stats.totalRevenue.toLocaleString()}`,
      subtitle: exchangeRate ? `~ $${Math.round(stats.totalRevenue / exchangeRate.usdToLkr).toLocaleString()} USD` : undefined,
      icon: Wallet,
      onClick: () => navigate('/reports?type=revenue'),
      color: 'text-success',
      bgColor: 'bg-success/10',
      borderColor: 'border-l-success',
    },
    {
      title: 'Arrivals Today',
      value: stats.arrivalsToday.toString(),
      icon: Clock,
      onClick: () => navigate('/bookings?filter=today'),
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      borderColor: 'border-l-warning',
    },
    {
      title: 'Available Rooms',
      value: stats.availableRooms.toString(),
      icon: BedDouble,
      onClick: () => navigate('/rooms'),
      color: 'text-info',
      bgColor: 'bg-info/10',
      borderColor: 'border-l-info',
    },
  ];

  return (
    <DashboardLayout title="Dashboard">
      <div className="space-y-5 sm:space-y-6">
        {/* Property Badge */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Viewing:</span>
          <PropertyBadge />
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {statCards.map((stat, i) => (
            <Card 
              key={stat.title} 
              className={cn(
                "cursor-pointer border-l-4 hover:shadow-lg transition-all duration-200",
                stat.borderColor
              )}
              onClick={stat.onClick}
            >
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <p className="text-xs sm:text-sm text-muted-foreground font-medium truncate">{stat.title}</p>
                    <p className={cn(
                      "text-xl sm:text-2xl font-bold text-foreground truncate animate-fade-in-up",
                    )} style={{ animationDelay: `${i * 80}ms` }}>
                      {stat.value}
                    </p>
                    {stat.subtitle && (
                      <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
                    )}
                  </div>
                  <div className={cn(
                    "p-2.5 sm:p-3 rounded-xl self-start sm:self-auto shrink-0",
                    stat.bgColor
                  )}>
                    <stat.icon className={cn("h-5 w-5 sm:h-6 sm:w-6", stat.color)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Content Grid */}
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
              {/* Decorative circle */}
              <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-primary-foreground/5" />
            </Card>

            {/* Exchange Rate Widget */}
            <Card className="overflow-hidden">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-muted-foreground font-medium">USD → LKR</p>
                    <p className="text-xl sm:text-2xl font-bold text-foreground mt-1">
                      Rs. {exchangeRate?.usdToLkr?.toFixed(2) || '--'}
                    </p>
                    <p className="text-xs text-muted-foreground/70 hidden sm:block mt-1">Real-time market rate</p>
                  </div>
                  <div className="p-2.5 sm:p-3 rounded-xl bg-success/10 shrink-0">
                    <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-success" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Availability Calendar Widget */}
        <DashboardAvailabilityCalendar />
      </div>
    </DashboardLayout>
  );
}

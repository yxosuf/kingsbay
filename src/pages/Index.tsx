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
  TrendingUp
} from 'lucide-react';
import { DashboardAvailabilityCalendar } from '@/components/dashboard/DashboardAvailabilityCalendar';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useProperty } from '@/hooks/useProperty';
import { PropertyBadge } from '@/components/layout/PropertyBadge';
import { useAuth } from '@/hooks/useAuth';

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
      
      // Fetch active guests (checked_in bookings)
      let activeGuestsQuery = supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'checked_in');
      if (propertyFilter) activeGuestsQuery = activeGuestsQuery.eq('property_id', selectedProperty.id);
      const { count: activeGuests } = await activeGuestsQuery;

      // Fetch today's arrivals
      const today = toDateString(new Date());
      let arrivalsQuery = supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('check_in', today)
        .in('status', ['pending', 'confirmed']);
      if (propertyFilter) arrivalsQuery = arrivalsQuery.eq('property_id', selectedProperty.id);
      const { count: arrivalsToday } = await arrivalsQuery;

      // Fetch available rooms dynamically: total rooms minus rooms with active bookings today
      let totalRoomsQuery = supabase
        .from('rooms')
        .select('id')
        .neq('status', 'maintenance');
      if (propertyFilter) totalRoomsQuery = totalRoomsQuery.eq('property_id', selectedProperty.id);
      const { data: allRooms } = await totalRoomsQuery;
      const totalRoomCount = allRooms?.length || 0;

      // Find rooms with blocking bookings for today using [check_in, check_out)
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

      // Fetch total revenue this month (from invoices)
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

      // Fetch today's check-ins (arrivals)
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

      // Fetch today's check-outs (departures)
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

      // Combine and format activity items
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
    // Using a simple weather approximation for Colombo
    // In production, you'd call a real weather API via edge function
    setWeather({
      temperature: 29.1,
      location: 'Colombo, Sri Lanka',
      condition: 'Partly Cloudy',
    });
  };

  const fetchExchangeRate = async () => {
    try {
      // Try to fetch from property_inventory_settings or use fallback
      const propertyId = selectedProperty?.id;
      if (propertyId) {
        const { data } = await supabase
          .from('property_inventory_settings')
          .select('*')
          .eq('property_id', propertyId)
          .maybeSingle();
        // If we have a stored rate, use it; otherwise use fallback
        // The fx_usd_lkr_rate column may not exist yet, so fallback gracefully
        const rate = (data as any)?.fx_usd_lkr_rate;
        if (rate) {
          setExchangeRate({ usdToLkr: Number(rate) });
          return;
        }
      }
      // Fallback to approximate rate
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
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }> = {
      pending: { variant: 'secondary', className: 'bg-warning/20 text-warning-foreground border-warning' },
      confirmed: { variant: 'outline', className: 'bg-info/20 text-info border-info' },
      checked_in: { variant: 'default', className: 'bg-success/20 text-success border-success' },
      checked_out: { variant: 'secondary', className: 'bg-muted text-muted-foreground' },
      cancelled: { variant: 'destructive', className: '' },
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
    },
    {
      title: 'Total Revenue',
      value: `Rs. ${stats.totalRevenue.toLocaleString()}`,
      icon: Wallet,
      onClick: () => navigate('/reports?type=revenue'),
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      title: 'Arrivals Today',
      value: stats.arrivalsToday.toString(),
      icon: Clock,
      onClick: () => navigate('/bookings?filter=today'),
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
    {
      title: 'Available Rooms',
      value: stats.availableRooms.toString(),
      icon: BedDouble,
      onClick: () => navigate('/rooms'),
      color: 'text-info',
      bgColor: 'bg-info/10',
    },
  ];

  return (
    <DashboardLayout title="Dashboard">
      <div className="space-y-4 sm:space-y-6">
        {/* Property Badge */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Viewing:</span>
          <PropertyBadge />
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {statCards.map((stat) => (
            <Card 
              key={stat.title} 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={stat.onClick}
            >
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">{stat.title}</p>
                    <p className="text-lg sm:text-2xl font-bold text-foreground truncate">{stat.value}</p>
                  </div>
                  <div className={`p-2 sm:p-3 rounded-xl ${stat.bgColor} self-start sm:self-auto shrink-0`}>
                    <stat.icon className={`h-5 w-5 sm:h-6 sm:w-6 ${stat.color}`} />
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
              <CardTitle className="text-base sm:text-lg">Today's Activity</CardTitle>
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
                <div className="text-center py-8 text-muted-foreground">
                  No check-ins or check-outs scheduled for today.
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-0">
                  {/* Mobile view */}
                  <div className="sm:hidden space-y-3">
                    {todayActivity.map((activity) => (
                      <Card key={`${activity.id}-${activity.type}`} className="border-border/50">
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div className={`p-1.5 rounded-full shrink-0 ${
                                activity.type === 'check_in' 
                                  ? 'bg-success/20' 
                                  : 'bg-warning/20'
                              }`}>
                                {activity.type === 'check_in' ? (
                                  <LogIn className={`h-3.5 w-3.5 text-success`} />
                                ) : (
                                  <LogOut className={`h-3.5 w-3.5 text-warning`} />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium truncate">{activity.guest_name}</p>
                                <p className="text-sm text-muted-foreground">Room {activity.room_number}</p>
                              </div>
                            </div>
                            <Badge 
                              variant="outline" 
                              className={activity.type === 'check_in' 
                                ? 'bg-success/10 text-success border-success' 
                                : 'bg-warning/10 text-warning border-warning'
                              }
                            >
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
                        <TableRow key={`${activity.id}-${activity.type}`}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className={`p-1.5 rounded-full ${
                                activity.type === 'check_in' 
                                  ? 'bg-success/20' 
                                  : 'bg-warning/20'
                              }`}>
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
            <Card className="bg-primary text-primary-foreground">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm opacity-80">Weather</p>
                    <p className="text-2xl sm:text-3xl font-bold">
                      {weather?.temperature || '--'}°C
                    </p>
                    <p className="text-xs sm:text-sm opacity-80 truncate">{weather?.location}</p>
                  </div>
                  <Cloud className="h-8 w-8 sm:h-12 sm:w-12 opacity-80 shrink-0" />
                </div>
              </CardContent>
            </Card>

            {/* Exchange Rate Widget */}
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm text-muted-foreground">USD Rate</p>
                    <p className="text-xl sm:text-2xl font-bold text-foreground">
                      Rs. {exchangeRate?.usdToLkr?.toFixed(2) || '--'}
                    </p>
                    <p className="text-xs text-muted-foreground hidden sm:block">Real-time market rate</p>
                  </div>
                  <div className="p-2 sm:p-3 rounded-xl bg-success/10 shrink-0">
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

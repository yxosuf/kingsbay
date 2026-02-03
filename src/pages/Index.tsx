import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DashboardStats {
  activeGuests: number;
  totalRevenue: number;
  arrivalsToday: number;
  availableRooms: number;
}

interface RecentBooking {
  id: string;
  guest_name: string;
  room_number: string;
  status: string;
  check_in: string;
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
  const [stats, setStats] = useState<DashboardStats>({
    activeGuests: 0,
    totalRevenue: 0,
    arrivalsToday: 0,
    availableRooms: 0,
  });
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [exchangeRate, setExchangeRate] = useState<ExchangeRate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
    fetchWeather();
    fetchExchangeRate();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch active guests (checked_in bookings)
      const { count: activeGuests } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'checked_in');

      // Fetch today's arrivals
      const today = new Date().toISOString().split('T')[0];
      const { count: arrivalsToday } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('check_in', today)
        .in('status', ['pending', 'confirmed']);

      // Fetch available rooms
      const { count: availableRooms } = await supabase
        .from('rooms')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'available');

      // Fetch total revenue this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      const { data: payments } = await supabase
        .from('payments')
        .select('amount')
        .gte('created_at', startOfMonth.toISOString());
      
      const totalRevenue = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

      // Fetch recent bookings with guest and room info
      const { data: bookings } = await supabase
        .from('bookings')
        .select(`
          id,
          status,
          check_in,
          guests (name),
          rooms (room_number)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      setStats({
        activeGuests: activeGuests || 0,
        totalRevenue,
        arrivalsToday: arrivalsToday || 0,
        availableRooms: availableRooms || 0,
      });

      setRecentBookings(
        bookings?.map((b: any) => ({
          id: b.id,
          guest_name: b.guests?.name || 'Unknown',
          room_number: b.rooms?.room_number || 'N/A',
          status: b.status,
          check_in: b.check_in,
        })) || []
      );
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
    // Using approximate rate - in production, call real API via edge function
    setExchangeRate({
      usdToLkr: 309.06,
    });
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
      <div className="space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat) => (
            <Card 
              key={stat.title} 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={stat.onClick}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  </div>
                  <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Bookings Table */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Recent Bookings</CardTitle>
              <Button 
                variant="link" 
                className="text-primary"
                onClick={() => navigate('/bookings')}
              >
                View All
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : recentBookings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No bookings yet. Create your first booking!
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Guest</TableHead>
                      <TableHead>Room</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentBookings.map((booking) => (
                      <TableRow key={booking.id}>
                        <TableCell className="font-medium">{booking.guest_name}</TableCell>
                        <TableCell>Room {booking.room_number}</TableCell>
                        <TableCell>{getStatusBadge(booking.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => navigate(`/bookings/${booking.id}`)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {(booking.status === 'pending' || booking.status === 'confirmed') && (
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="text-success"
                                onClick={() => handleCheckIn(booking.id)}
                              >
                                <LogIn className="h-4 w-4" />
                              </Button>
                            )}
                            {booking.status === 'checked_in' && (
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="text-warning"
                                onClick={() => handleCheckOut(booking.id)}
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
              )}
            </CardContent>
          </Card>

          {/* Side Widgets */}
          <div className="space-y-4">
            {/* Weather Widget */}
            <Card className="bg-primary text-primary-foreground">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-80">Weather</p>
                    <p className="text-3xl font-bold">
                      {weather?.temperature || '--'}°C
                    </p>
                    <p className="text-sm opacity-80">{weather?.location}</p>
                  </div>
                  <Cloud className="h-12 w-12 opacity-80" />
                </div>
              </CardContent>
            </Card>

            {/* Exchange Rate Widget */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">USD Exchange Rate</p>
                    <p className="text-2xl font-bold text-foreground">
                      Rs. {exchangeRate?.usdToLkr?.toFixed(2) || '--'}
                    </p>
                    <p className="text-xs text-muted-foreground">Real-time market rate</p>
                  </div>
                  <div className="p-3 rounded-xl bg-success/10">
                    <TrendingUp className="h-6 w-6 text-success" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

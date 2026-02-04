import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Search, Eye, LogIn, LogOut, X, BookOpen } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useProperty } from '@/hooks/useProperty';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';

interface Booking {
  id: string;
  check_in: string;
  check_out: string;
  status: string;
  num_guests: number;
  total_amount: number;
  room_id: string;
  property_id: string | null;
  guests: { name: string; phone: string } | null;
  rooms: { room_number: string; room_type: string } | null;
}

export default function Bookings() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { selectedProperty, showAllProperties } = useProperty();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('filter') || 'all');
  const isMobile = useIsMobile();

  useEffect(() => {
    fetchBookings();
  }, [statusFilter, selectedProperty, showAllProperties]);

  const fetchBookings = async () => {
    try {
      let query = supabase
        .from('bookings')
        .select(`
          id,
          check_in,
          check_out,
          status,
          num_guests,
          total_amount,
          room_id,
          property_id,
          guests (name, phone),
          rooms (room_number, room_type)
        `)
        .order('created_at', { ascending: false });

      // Filter by property
      if (!showAllProperties && selectedProperty?.id) {
        query = query.eq('property_id', selectedProperty.id);
      }

      if (statusFilter === 'today') {
        const today = new Date().toISOString().split('T')[0];
        query = query.eq('check_in', today);
      } else if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as any);
      }

      const { data, error } = await query;
      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async (bookingId: string, roomId: string) => {
    try {
      const { error: bookingError } = await supabase
        .from('bookings')
        .update({ status: 'checked_in' })
        .eq('id', bookingId);

      if (bookingError) throw bookingError;

      const { error: roomError } = await supabase
        .from('rooms')
        .update({ status: 'occupied' })
        .eq('id', roomId);

      if (roomError) throw roomError;

      toast.success('Guest checked in successfully');
      fetchBookings();
    } catch (error) {
      toast.error('Failed to check in guest');
    }
  };

  const handleCancel = async (bookingId: string) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', bookingId);

      if (error) throw error;
      toast.success('Booking cancelled');
      fetchBookings();
    } catch (error) {
      toast.error('Failed to cancel booking');
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

  const filteredBookings = bookings.filter(
    (booking) =>
      booking.guests?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.rooms?.room_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderMobileCard = (booking: Booking) => (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{booking.guests?.name || 'Unknown'}</p>
          <p className="text-sm text-muted-foreground">{booking.guests?.phone}</p>
        </div>
        {getStatusBadge(booking.status)}
      </div>
      
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-muted-foreground">Room</p>
          <p className="font-medium">
            {booking.rooms?.room_number || 'N/A'} 
            <span className="text-muted-foreground capitalize"> · {booking.rooms?.room_type}</span>
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Amount</p>
          <p className="font-medium">Rs. {booking.total_amount?.toLocaleString() || '0'}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Check-in</p>
          <p className="font-medium">{new Date(booking.check_in).toLocaleDateString()}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Check-out</p>
          <p className="font-medium">{new Date(booking.check_out).toLocaleDateString()}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2 border-t">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => navigate(`/bookings/${booking.id}`)}
        >
          <Eye className="h-4 w-4 mr-1" />
          View
        </Button>
        {(booking.status === 'pending' || booking.status === 'confirmed') && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="text-success border-success hover:bg-success/10"
              onClick={() => handleCheckIn(booking.id, booking.room_id)}
            >
              <LogIn className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive border-destructive hover:bg-destructive/10"
              onClick={() => handleCancel(booking.id)}
            >
              <X className="h-4 w-4" />
            </Button>
          </>
        )}
        {booking.status === 'checked_in' && (
          <Button
            variant="outline"
            size="sm"
            className="text-warning border-warning hover:bg-warning/10"
            onClick={() => navigate(`/bookings/${booking.id}/checkout`)}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <DashboardLayout title="Bookings">
      <div className="space-y-4 sm:space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4 sm:justify-between">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:flex-1">
            <div className="relative flex-1 sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search guest or room..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Bookings</SelectItem>
                <SelectItem value="today">Today's Arrivals</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="checked_in">Checked In</SelectItem>
                <SelectItem value="checked_out">Checked Out</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => navigate('/bookings/new')} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            New Booking
          </Button>
        </div>

        {/* Bookings Content */}
        <Card>
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className="text-base sm:text-lg">All Bookings</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : filteredBookings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No bookings found.</p>
              </div>
            ) : isMobile ? (
              <div className="space-y-3">
                {filteredBookings.map((booking) => (
                  <Card key={booking.id} className="border-border/50">
                    <CardContent className="p-4">
                      {renderMobileCard(booking)}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Guest</TableHead>
                    <TableHead>Room</TableHead>
                    <TableHead>Check-in</TableHead>
                    <TableHead>Check-out</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBookings.map((booking) => (
                    <TableRow key={booking.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{booking.guests?.name || 'Unknown'}</p>
                          <p className="text-sm text-muted-foreground">{booking.guests?.phone}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p>Room {booking.rooms?.room_number || 'N/A'}</p>
                          <p className="text-sm text-muted-foreground capitalize">
                            {booking.rooms?.room_type}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{new Date(booking.check_in).toLocaleDateString()}</TableCell>
                      <TableCell>{new Date(booking.check_out).toLocaleDateString()}</TableCell>
                      <TableCell>{getStatusBadge(booking.status)}</TableCell>
                      <TableCell>Rs. {booking.total_amount?.toLocaleString() || '0'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/bookings/${booking.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {(booking.status === 'pending' || booking.status === 'confirmed') && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-success"
                                onClick={() => handleCheckIn(booking.id, booking.room_id)}
                              >
                                <LogIn className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive"
                                onClick={() => handleCancel(booking.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {booking.status === 'checked_in' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-warning"
                              onClick={() => navigate(`/bookings/${booking.id}/checkout`)}
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
      </div>
    </DashboardLayout>
  );
}

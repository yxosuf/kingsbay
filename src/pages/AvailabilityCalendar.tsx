import { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Calendar, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useProperty } from '@/hooks/useProperty';
import { toast } from 'sonner';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday, addWeeks, subWeeks, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';

interface Room {
  id: string;
  room_number: string;
  room_type: string;
  status: string;
  property_id: string;
}

interface Booking {
  id: string;
  room_id: string;
  check_in: string;
  check_out: string;
  status: string;
  guest: {
    name: string;
  };
}

interface RoomAvailability {
  id: string;
  room_id: string;
  date: string;
  is_available: boolean;
  blocked_reason: string | null;
  booking_id: string | null;
  source_channel: string | null;
}

interface InventorySettings {
  safety_buffer: number;
  auto_close_at: number;
}

type ViewMode = 'week' | 'month';

export default function AvailabilityCalendar() {
  const { selectedProperty } = useProperty();
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [availability, setAvailability] = useState<RoomAvailability[]>([]);
  const [inventorySettings, setInventorySettings] = useState<InventorySettings | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [selectedRoomType, setSelectedRoomType] = useState<string>('all');

  const dateRange = useMemo(() => {
    if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return eachDayOfInterval({ start, end });
    } else {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      return eachDayOfInterval({ start, end });
    }
  }, [currentDate, viewMode]);

  useEffect(() => {
    if (selectedProperty?.id) {
      fetchData();
    }
  }, [selectedProperty?.id, dateRange]);

  const fetchData = async () => {
    if (!selectedProperty?.id) return;
    setLoading(true);

    try {
      const startDate = format(dateRange[0], 'yyyy-MM-dd');
      const endDate = format(dateRange[dateRange.length - 1], 'yyyy-MM-dd');

      // Fetch rooms
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('id, room_number, room_type, status, property_id')
        .eq('property_id', selectedProperty.id)
        .order('room_number');

      if (roomError) throw roomError;
      setRooms(roomData || []);

      // Fetch bookings for the date range
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .select(`
          id,
          room_id,
          check_in,
          check_out,
          status,
          guest:guests(name)
        `)
        .eq('property_id', selectedProperty.id)
        .lte('check_in', endDate)
        .gte('check_out', startDate)
        .in('status', ['confirmed', 'checked_in', 'pending']);

      if (bookingError) throw bookingError;
      setBookings((bookingData || []).map(b => ({
        ...b,
        guest: Array.isArray(b.guest) ? b.guest[0] : b.guest
      })) as Booking[]);

      // Fetch room availability blocks
      const { data: availabilityData, error: availabilityError } = await supabase
        .from('room_availability')
        .select('*')
        .in('room_id', (roomData || []).map(r => r.id))
        .gte('date', startDate)
        .lte('date', endDate);

      if (availabilityError) throw availabilityError;
      setAvailability(availabilityData || []);

      // Fetch inventory settings
      const { data: settingsData } = await supabase
        .from('property_inventory_settings')
        .select('safety_buffer, auto_close_at')
        .eq('property_id', selectedProperty.id)
        .maybeSingle();

      setInventorySettings(settingsData);
    } catch (error) {
      console.error('Error fetching availability data:', error);
      toast.error('Failed to load availability data');
    } finally {
      setLoading(false);
    }
  };

  const getRoomTypes = () => {
    const types = new Set(rooms.map(r => r.room_type));
    return Array.from(types);
  };

  const filteredRooms = selectedRoomType === 'all' 
    ? rooms 
    : rooms.filter(r => r.room_type === selectedRoomType);

  const getCellStatus = (room: Room, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');

    // Check for manual blocks in room_availability
    const block = availability.find(
      a => a.room_id === room.id && a.date === dateStr && !a.is_available
    );
    if (block) {
      return {
        status: 'blocked',
        reason: block.blocked_reason || 'Blocked',
        color: 'bg-muted text-muted-foreground',
      };
    }

    // Check for bookings
    const booking = bookings.find(b => {
      const checkIn = new Date(b.check_in);
      const checkOut = new Date(b.check_out);
      return b.room_id === room.id && date >= checkIn && date < checkOut;
    });

    if (booking) {
      const isCheckInDay = isSameDay(date, new Date(booking.check_in));
      const isLastDay = isSameDay(addDays(date, 1), new Date(booking.check_out));
      
      return {
        status: booking.status === 'checked_in' ? 'occupied' : 'reserved',
        guestName: booking.guest?.name || 'Guest',
        bookingId: booking.id,
        isStart: isCheckInDay,
        isEnd: isLastDay,
        color: booking.status === 'checked_in' 
          ? 'bg-destructive/20 text-destructive-foreground border-destructive/30'
          : 'bg-warning/20 text-warning-foreground border-warning/30',
      };
    }

    // Room is in maintenance
    if (room.status === 'maintenance') {
      return {
        status: 'maintenance',
        color: 'bg-muted text-muted-foreground',
      };
    }

    return {
      status: 'available',
      color: 'bg-green-500/10 text-green-700 dark:text-green-400',
    };
  };

  const getInventorySummary = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    let available = 0;
    let booked = 0;
    let blocked = 0;

    rooms.forEach(room => {
      const status = getCellStatus(room, date);
      if (status.status === 'available') available++;
      else if (status.status === 'reserved' || status.status === 'occupied') booked++;
      else blocked++;
    });

    const safetyBuffer = inventorySettings?.safety_buffer || 0;
    const sellable = Math.max(0, available - safetyBuffer);

    return { available, booked, blocked, sellable, total: rooms.length };
  };

  const navigatePeriod = (direction: 'prev' | 'next') => {
    if (viewMode === 'week') {
      setCurrentDate(direction === 'prev' ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1));
    } else {
      const newDate = new Date(currentDate);
      newDate.setMonth(newDate.getMonth() + (direction === 'prev' ? -1 : 1));
      setCurrentDate(newDate);
    }
  };

  if (!selectedProperty) {
    return (
      <DashboardLayout title="Availability Calendar">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Please select a property first</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Availability Calendar">
      <div className="space-y-6">
        {/* Header Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigatePeriod('prev')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => navigatePeriod('next')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-semibold">
              {viewMode === 'week' 
                ? `${format(dateRange[0], 'MMM d')} - ${format(dateRange[dateRange.length - 1], 'MMM d, yyyy')}`
                : format(currentDate, 'MMMM yyyy')
              }
            </h2>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setCurrentDate(new Date())}
            >
              Today
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Select value={selectedRoomType} onValueChange={setSelectedRoomType}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All room types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {getRoomTypes().map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="month">Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Inventory Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-600">
                {getInventorySummary(new Date()).sellable}
              </div>
              <p className="text-xs text-muted-foreground">Sellable Today</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{rooms.length}</div>
              <p className="text-xs text-muted-foreground">Total Rooms</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-amber-600">
                {getInventorySummary(new Date()).booked}
              </div>
              <p className="text-xs text-muted-foreground">Booked Today</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-muted-foreground">
                {inventorySettings?.safety_buffer || 0}
              </div>
              <p className="text-xs text-muted-foreground">Safety Buffer</p>
            </CardContent>
          </Card>
        </div>

        {/* Calendar Grid */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Room Availability Grid
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : filteredRooms.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No rooms found for this property
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-max">
                  <thead>
                    <tr>
                      <th className="sticky left-0 bg-card z-10 p-2 text-left font-medium text-sm border-b w-32">
                        Room
                      </th>
                      {dateRange.map(date => (
                        <th 
                          key={date.toISOString()} 
                          className={cn(
                            "p-2 text-center text-xs font-medium border-b min-w-[60px]",
                            isToday(date) && "bg-primary/10"
                          )}
                        >
                          <div>{format(date, 'EEE')}</div>
                          <div className={cn(
                            "text-lg",
                            isToday(date) && "text-primary font-bold"
                          )}>
                            {format(date, 'd')}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRooms.map(room => (
                      <tr key={room.id} className="hover:bg-muted/50">
                        <td className="sticky left-0 bg-card z-10 p-2 border-b">
                          <div className="font-medium">{room.room_number}</div>
                          <div className="text-xs text-muted-foreground">{room.room_type}</div>
                        </td>
                        {dateRange.map(date => {
                          const cell = getCellStatus(room, date);
                          return (
                            <td 
                              key={date.toISOString()} 
                              className={cn(
                                "p-1 border-b border-r text-center min-w-[60px]",
                                isToday(date) && "bg-primary/5"
                              )}
                            >
                              <div 
                                className={cn(
                                  "h-10 rounded flex items-center justify-center text-xs font-medium",
                                  cell.color,
                                  cell.isStart && "rounded-l-lg",
                                  cell.isEnd && "rounded-r-lg"
                                )}
                                title={cell.guestName || cell.reason || cell.status}
                              >
                                {cell.status === 'available' && '✓'}
                                {cell.status === 'reserved' && 'R'}
                                {cell.status === 'occupied' && 'O'}
                                {cell.status === 'blocked' && '✕'}
                                {cell.status === 'maintenance' && 'M'}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-green-500/10 flex items-center justify-center text-green-700 text-xs">✓</div>
                <span className="text-sm">Available</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-warning/20 flex items-center justify-center text-warning-foreground text-xs">R</div>
                <span className="text-sm">Reserved</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-destructive/20 flex items-center justify-center text-destructive text-xs">O</div>
                <span className="text-sm">Occupied</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-muted flex items-center justify-center text-muted-foreground text-xs">✕</div>
                <span className="text-sm">Blocked</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-muted flex items-center justify-center text-muted-foreground text-xs">M</div>
                <span className="text-sm">Maintenance</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Low Inventory Warning */}
        {inventorySettings && getInventorySummary(new Date()).sellable <= inventorySettings.auto_close_at && (
          <Card className="border-warning">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <div>
                <p className="font-medium">Low Inventory Warning</p>
                <p className="text-sm text-muted-foreground">
                  Available rooms today ({getInventorySummary(new Date()).sellable}) is at or below your auto-close threshold ({inventorySettings.auto_close_at}).
                  Consider closing OTA availability.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

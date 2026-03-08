import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ChevronLeft, ChevronRight, Calendar, AlertTriangle, BedDouble, ShieldCheck, Lock, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useProperty } from '@/hooks/useProperty';
import { toast } from 'sonner';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isToday, addWeeks, subWeeks, startOfMonth, endOfMonth, isWeekend } from 'date-fns';
import { cn } from '@/lib/utils';
import { toDateString, isDateInBookingRange } from '@/lib/dateUtils';

interface Room {
  id: string;
  room_number: string;
  room_type: string;
  status: string;
  property_id: string;
  housekeeping_status: string;
  cleaning_until: string | null;
}

interface Booking {
  id: string;
  room_id: string;
  check_in: string;
  check_out: string;
  status: string;
  hold_expires_at: string | null;
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
  const navigate = useNavigate();
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

      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('id, room_number, room_type, status, property_id, housekeeping_status, cleaning_until')
        .eq('property_id', selectedProperty.id)
        .order('room_number');

      if (roomError) throw roomError;
      setRooms(roomData || []);

      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .select(`
          id, room_id, check_in, check_out, status, hold_expires_at,
          guest:guests(name)
        `)
        .eq('property_id', selectedProperty.id)
        .lt('check_in', endDate)
        .gt('check_out', startDate)
        .in('status', ['confirmed', 'checked_in', 'pending', 'needs_review']);

      if (bookingError) throw bookingError;
      setBookings((bookingData || []).map(b => ({
        ...b,
        guest: Array.isArray(b.guest) ? b.guest[0] : b.guest
      })) as Booking[]);

      const { data: availabilityData, error: availabilityError } = await supabase
        .from('room_availability')
        .select('*')
        .in('room_id', (roomData || []).map(r => r.id))
        .gte('date', startDate)
        .lte('date', endDate);

      if (availabilityError) throw availabilityError;
      setAvailability(availabilityData || []);

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

  // Get bookings for a specific room, visible in the date range
  const getRoomBookings = (room: Room) => {
    const startStr = toDateString(dateRange[0]);
    const endStr = toDateString(dateRange[dateRange.length - 1]);
    
    return bookings.filter(b => {
      if (b.room_id !== room.id) return false;
      if (b.status === 'needs_review') {
        if (!b.hold_expires_at) return false;
        if (new Date(b.hold_expires_at) <= new Date()) return false;
      }
      // Booking overlaps with visible range: check_in < endStr+1 && check_out > startStr
      return b.check_in <= endStr && b.check_out > startStr;
    });
  };

  // Get block ranges for a room
  const getRoomBlocks = (room: Room) => {
    return availability.filter(a => a.room_id === room.id && !a.is_available);
  };

  // Calculate pixel position for a date within the range
  const getDateIndex = (dateStr: string): number => {
    const startStr = toDateString(dateRange[0]);
    if (dateStr < startStr) return 0;
    const endStr = toDateString(dateRange[dateRange.length - 1]);
    if (dateStr > endStr) return dateRange.length;
    return dateRange.findIndex(d => toDateString(d) === dateStr);
  };

  const getInventorySummary = (date: Date) => {
    const dateStr = toDateString(date);
    let available = 0;
    let booked = 0;
    let blocked = 0;

    rooms.forEach(room => {
      const block = availability.find(a => a.room_id === room.id && a.date === dateStr && !a.is_available);
      if (block) { blocked++; return; }
      
      const booking = bookings.find(b => {
        if (b.room_id !== room.id) return false;
        if (b.status === 'needs_review') {
          if (!b.hold_expires_at) return false;
          if (new Date(b.hold_expires_at) <= new Date()) return false;
        }
        return isDateInBookingRange(dateStr, b.check_in, b.check_out);
      });
      
      if (booking) { booked++; } else if (room.status !== 'maintenance') { available++; } else { blocked++; }
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

  const colWidth = viewMode === 'month' ? 36 : 80;

  if (!selectedProperty) {
    return (
      <DashboardLayout title="Availability Calendar">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Please select a property first</p>
        </div>
      </DashboardLayout>
    );
  }

  const todaySummary = getInventorySummary(new Date());

  return (
    <DashboardLayout title="Availability Calendar">
      <div className="space-y-5">
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
                ? `${format(dateRange[0], 'MMM d')} – ${format(dateRange[dateRange.length - 1], 'MMM d, yyyy')}`
                : format(currentDate, 'MMMM yyyy')
              }
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date())}>
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Sellable Today', value: todaySummary.sellable, icon: ShieldCheck, color: 'text-success', bg: 'bg-success/10' },
            { label: 'Total Rooms', value: rooms.length, icon: BedDouble, color: 'text-foreground', bg: 'bg-muted' },
            { label: 'Booked Today', value: todaySummary.booked, icon: Calendar, color: 'text-warning', bg: 'bg-warning/10' },
            { label: 'Safety Buffer', value: inventorySettings?.safety_buffer || 0, icon: Lock, color: 'text-muted-foreground', bg: 'bg-muted' },
          ].map((item, i) => (
            <Card key={item.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn("p-2 rounded-xl", item.bg)}>
                  <item.icon className={cn("h-5 w-5", item.color)} />
                </div>
                <div>
                  <p className={cn("text-2xl font-bold animate-fade-in-up", item.color)} style={{ animationDelay: `${i * 60}ms` }}>
                    {item.value}
                  </p>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Gantt Calendar Grid */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-5 w-5 text-primary" />
              Room Availability
            </CardTitle>
          </CardHeader>
          <CardContent className="px-0 sm:px-2">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : filteredRooms.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No rooms found for this property
              </div>
            ) : (
              <TooltipProvider>
                <div className="overflow-x-auto scrollbar-thin">
                  <div style={{ minWidth: `${120 + dateRange.length * colWidth}px` }}>
                    {/* Header row */}
                    <div className="flex border-b sticky top-0 bg-card z-20">
                      <div className="w-[120px] shrink-0 p-2 text-xs font-medium text-muted-foreground sticky left-0 bg-card z-30 border-r">
                        Room
                      </div>
                      {dateRange.map(date => {
                        const weekend = isWeekend(date);
                        const today = isToday(date);
                        return (
                          <div
                            key={date.toISOString()}
                            className={cn(
                              "text-center border-r border-b-0 flex-shrink-0",
                              weekend && "weekend-col",
                              today && "bg-primary/5"
                            )}
                            style={{ width: colWidth }}
                          >
                            <div className="text-[10px] text-muted-foreground pt-1">{format(date, 'EEE')}</div>
                            <div className={cn(
                              "text-sm pb-1",
                              today && "text-primary font-bold"
                            )}>
                              {format(date, 'd')}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Room rows with Gantt bars */}
                    {filteredRooms.map(room => {
                      const roomBookings = getRoomBookings(room);
                      const roomBlocks = getRoomBlocks(room);

                      return (
                        <div key={room.id} className="flex border-b hover:bg-muted/20 transition-colors relative group" style={{ height: 44 }}>
                          {/* Room label */}
                          <div className="w-[120px] shrink-0 p-2 sticky left-0 bg-card z-10 border-r flex items-center">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="truncate">
                                  <span className="font-medium text-sm">{room.room_number}</span>
                                  <span className="text-[10px] text-muted-foreground ml-1.5 hidden sm:inline">{room.room_type}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{room.room_number} – {room.room_type}</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>

                          {/* Date cells background */}
                          <div className="flex flex-1 relative">
                            {dateRange.map(date => (
                              <div
                                key={date.toISOString()}
                                className={cn(
                                  "border-r flex-shrink-0",
                                  isWeekend(date) && "weekend-col",
                                  isToday(date) && "today-line"
                                )}
                                style={{ width: colWidth, height: '100%' }}
                              />
                            ))}

                            {/* Gantt booking bars */}
                            {roomBookings.map(booking => {
                              const startIdx = Math.max(0, getDateIndex(booking.check_in));
                              // check_out is exclusive: bar ends at check_out column start
                              const endDateStr = booking.check_out;
                              const endIdx = Math.min(dateRange.length, getDateIndex(endDateStr));
                              if (endIdx <= startIdx) return null;

                              const barType = booking.status === 'checked_in' ? 'occupied' 
                                : booking.status === 'needs_review' ? 'held' 
                                : 'reserved';

                              const left = startIdx * colWidth;
                              const width = (endIdx - startIdx) * colWidth - 4;

                              return (
                                <Tooltip key={booking.id}>
                                  <TooltipTrigger asChild>
                                    <div
                                      className={cn("gantt-bar", `gantt-bar-${barType}`)}
                                      style={{ left: left + 2, width: Math.max(width, 20) }}
                                      onClick={() => navigate(`/bookings/${booking.id}`)}
                                    >
                                      {width > 60 && (
                                        <span className="truncate">{booking.guest?.name || 'Guest'}</span>
                                      )}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="font-medium">{booking.guest?.name || 'Guest'}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {booking.check_in} → {booking.check_out} · {barType}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              );
                            })}

                            {/* Block bars */}
                            {roomBlocks.map(block => {
                              const idx = getDateIndex(block.date);
                              if (idx < 0) return null;
                              return (
                                <Tooltip key={block.id}>
                                  <TooltipTrigger asChild>
                                    <div
                                      className="gantt-bar gantt-bar-blocked"
                                      style={{ left: idx * colWidth + 2, width: colWidth - 4 }}
                                    >
                                      {colWidth > 50 && <span>✕</span>}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{block.blocked_reason || 'Blocked'}</p>
                                  </TooltipContent>
                                </Tooltip>
                              );
                            })}

                            {/* Maintenance overlay */}
                            {room.status === 'maintenance' && (
                              <div
                                className="gantt-bar gantt-bar-blocked"
                                style={{ left: 2, width: dateRange.length * colWidth - 4 }}
                              >
                                {colWidth * dateRange.length > 120 && <span>Maintenance</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t px-3">
                  {[
                    { cls: 'gantt-bar-reserved', label: 'Reserved' },
                    { cls: 'gantt-bar-occupied', label: 'Occupied' },
                    { cls: 'gantt-bar-held', label: 'Held' },
                    { cls: 'gantt-bar-blocked', label: 'Blocked' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-1.5">
                      <div className={cn("w-8 h-4 rounded", item.cls)} />
                      <span className="text-xs text-muted-foreground">{item.label}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-1.5">
                    <div className="w-0.5 h-4 bg-primary/30 rounded" />
                    <span className="text-xs text-muted-foreground">Today</span>
                  </div>
                </div>
              </TooltipProvider>
            )}
          </CardContent>
        </Card>

        {/* Low Inventory Warning */}
        {inventorySettings && todaySummary.sellable <= inventorySettings.auto_close_at && (
          <Card className="border-warning">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertTriangle className="h-5 w-5 text-warning" />
              <div>
                <p className="font-medium">Low Inventory Warning</p>
                <p className="text-sm text-muted-foreground">
                  Available rooms today ({todaySummary.sellable}) is at or below your auto-close threshold ({inventorySettings.auto_close_at}).
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

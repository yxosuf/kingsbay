import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { ChevronLeft, ChevronRight, Calendar, AlertTriangle, BedDouble, ShieldCheck, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useProperty } from '@/hooks/useProperty';
import { toast } from 'sonner';
import { format, eachDayOfInterval, isToday, addWeeks, subWeeks, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWeekend } from 'date-fns';
import { cn } from '@/lib/utils';
import { toDateString, isDateInBookingRange } from '@/lib/dateUtils';
import { getCellStatus, cellStatusClass, filterRoomBookings, type CellStatus } from '@/lib/calendarCellStatus';

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
  guest: { name: string };
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
  const isMobile = useIsMobile();
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

  const rangeStart = useMemo(() => toDateString(dateRange[0]), [dateRange]);
  const rangeEnd = useMemo(() => toDateString(dateRange[dateRange.length - 1]), [dateRange]);

  useEffect(() => {
    if (selectedProperty?.id) {
      fetchData();
    }
  }, [selectedProperty?.id, dateRange]);

  const fetchData = async () => {
    if (!selectedProperty?.id) return;
    setLoading(true);

    try {
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
        .lt('check_in', rangeEnd)
        .gt('check_out', rangeStart)
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
        .gte('date', rangeStart)
        .lte('date', rangeEnd);

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

  const renderCellTooltip = (status: CellStatus) => {
    if (status.type === 'available') return null;
    if (status.booking) {
      return (
        <TooltipContent>
          <p className="font-medium">{status.booking.guest?.name || 'Guest'}</p>
          <p className="text-xs text-muted-foreground">
            {status.booking.check_in} → {status.booking.check_out} · {status.type}
          </p>
        </TooltipContent>
      );
    }
    return (
      <TooltipContent>
        <p>{status.reason || status.type}</p>
      </TooltipContent>
    );
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

  const todaySummary = getInventorySummary(new Date());

  return (
    <DashboardLayout title="Availability Calendar">
      <div className="space-y-5">
        {/* Header Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8 sm:h-10 sm:w-10" onClick={() => navigatePeriod('prev')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8 sm:h-10 sm:w-10" onClick={() => navigatePeriod('next')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <h2 className="text-sm sm:text-lg font-semibold">
              {viewMode === 'week' 
                ? `${format(dateRange[0], 'MMM d')} – ${format(dateRange[dateRange.length - 1], 'MMM d, yyyy')}`
                : format(currentDate, 'MMMM yyyy')
              }
            </h2>
            <Button variant="ghost" size="sm" className="h-7 text-xs sm:text-sm" onClick={() => setCurrentDate(new Date())}>
              Today
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Select value={selectedRoomType} onValueChange={setSelectedRoomType}>
              <SelectTrigger className="w-[120px] sm:w-[150px] h-8 sm:h-10 text-xs sm:text-sm">
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
              <SelectTrigger className="w-[90px] sm:w-[120px] h-8 sm:h-10 text-xs sm:text-sm">
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
          {[
            { label: 'Sellable Today', value: todaySummary.sellable, icon: ShieldCheck, color: 'text-success', bg: 'bg-success/10' },
            { label: 'Total Rooms', value: rooms.length, icon: BedDouble, color: 'text-foreground', bg: 'bg-muted' },
            { label: 'Booked Today', value: todaySummary.booked, icon: Calendar, color: 'text-warning', bg: 'bg-warning/10' },
            { label: 'Safety Buffer', value: inventorySettings?.safety_buffer || 0, icon: Lock, color: 'text-muted-foreground', bg: 'bg-muted' },
          ].map((item, i) => (
            <Card key={item.label}>
              <CardContent className="p-2.5 sm:p-4 flex items-center gap-2 sm:gap-3">
                <div className={cn("p-1.5 sm:p-2 rounded-lg sm:rounded-xl", item.bg)}>
                  <item.icon className={cn("h-4 w-4 sm:h-5 sm:w-5", item.color)} />
                </div>
                <div>
                  <p className={cn("text-lg sm:text-2xl font-bold animate-fade-in-up", item.color)} style={{ animationDelay: `${i * 60}ms` }}>
                    {item.value}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{item.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Cell-Based Calendar Grid */}
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
                  <div
                    className="grid"
                    style={{
                      gridTemplateColumns: `${isMobile ? '70px' : '120px'} repeat(${dateRange.length}, minmax(${viewMode === 'month' ? (isMobile ? '28px' : '36px') : (isMobile ? '44px' : '80px')}, 1fr))`,
                    }}
                  >
                    {/* Header row */}
                    <div className="p-1.5 sm:p-2 text-[10px] sm:text-xs font-medium text-muted-foreground sticky left-0 bg-card z-30 border-r border-b">
                      Room
                    </div>
                    {dateRange.map(date => (
                      <div
                        key={date.toISOString()}
                        className={cn(
                          "text-center border-r border-b",
                          isWeekend(date) && "weekend-col",
                          isToday(date) && "bg-primary/5"
                        )}
                      >
                        <div className="text-[10px] text-muted-foreground pt-1">{format(date, 'EEE')}</div>
                        <div className={cn(
                          "text-sm pb-1",
                          isToday(date) && "text-primary font-bold"
                        )}>
                          {format(date, 'd')}
                        </div>
                      </div>
                    ))}

                    {/* Room rows */}
                    {filteredRooms.map(room => {
                      const roomBookings = filterRoomBookings(bookings, room.id, rangeStart, rangeEnd);
                      const roomBlocks = availability.filter(a => a.room_id === room.id && !a.is_available);

                      return (
                        <>
                          {/* Room label */}
                          <div key={`label-${room.id}`} className="p-1 sm:p-2 sticky left-0 bg-card z-10 border-r border-b flex items-center group">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="truncate">
                                  <span className="font-medium text-xs sm:text-sm">{room.room_number}</span>
                                  <span className="text-[10px] text-muted-foreground ml-1.5 hidden sm:inline">{room.room_type}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{room.room_number} – {room.room_type}</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>

                          {/* Date cells */}
                          {dateRange.map(date => {
                            const dateStr = toDateString(date);
                            const status = getCellStatus(dateStr, room, roomBookings, roomBlocks);
                            const statusCls = cellStatusClass(status.type);
                            const isClickable = !!status.booking;

                            const cell = (
                              <div
                                key={`${room.id}-${dateStr}`}
                                className={cn(
                                  "border-r border-b h-8 sm:h-11 transition-colors hover:brightness-95",
                                  isWeekend(date) && status.type === 'available' && "weekend-col",
                                  isToday(date) && status.type === 'available' && "today-line",
                                  statusCls,
                                  isClickable && "cursor-pointer"
                                )}
                                onClick={isClickable ? () => navigate(`/bookings/${status.booking!.id}`) : undefined}
                              />
                            );

                            if (status.type === 'available') return cell;

                            return (
                              <Tooltip key={`${room.id}-${dateStr}`}>
                                <TooltipTrigger asChild>{cell}</TooltipTrigger>
                                {renderCellTooltip(status)}
                              </Tooltip>
                            );
                          })}
                        </>
                      );
                    })}
                  </div>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-2 sm:gap-4 mt-3 sm:mt-4 pt-2 sm:pt-3 border-t px-2 sm:px-3">
                  {[
                    { cls: 'cell-reserved', label: 'Reserved' },
                    { cls: 'cell-occupied', label: 'Occupied' },
                    { cls: 'cell-held', label: 'Held' },
                    { cls: 'cell-blocked', label: 'Blocked' },
                    { cls: 'cell-cleaning', label: 'Cleaning' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-1 sm:gap-1.5">
                      <div className={cn("w-5 sm:w-8 h-3 sm:h-4 rounded", item.cls)} />
                      <span className="text-[10px] sm:text-xs text-muted-foreground">{item.label}</span>
                    </div>
                  ))}
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    <div className="w-0.5 h-3 sm:h-4 bg-primary/30 rounded" />
                    <span className="text-[10px] sm:text-xs text-muted-foreground">Today</span>
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

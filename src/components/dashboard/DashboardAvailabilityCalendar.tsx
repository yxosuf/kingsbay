import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Calendar, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useProperty } from '@/hooks/useProperty';
import { format, addDays, eachDayOfInterval, isToday, isWeekend } from 'date-fns';
import { cn } from '@/lib/utils';
import { toDateString, isDateInBookingRange } from '@/lib/dateUtils';

interface Room {
  id: string;
  room_number: string;
  room_type: string;
  status: string;
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
}

export function DashboardAvailabilityCalendar() {
  const navigate = useNavigate();
  const { selectedProperty } = useProperty();
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [availability, setAvailability] = useState<RoomAvailability[]>([]);

  const dateRange = useMemo(() => {
    const start = new Date();
    const end = addDays(start, 6);
    return eachDayOfInterval({ start, end });
  }, []);

  useEffect(() => {
    if (selectedProperty?.id) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [selectedProperty?.id]);

  const fetchData = async () => {
    if (!selectedProperty?.id) return;
    setLoading(true);

    try {
      const startDate = format(dateRange[0], 'yyyy-MM-dd');
      const endDate = format(dateRange[dateRange.length - 1], 'yyyy-MM-dd');

      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('id, room_number, room_type, status')
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
        .select('id, room_id, date, is_available, blocked_reason')
        .in('room_id', (roomData || []).map(r => r.id))
        .gte('date', startDate)
        .lte('date', endDate);

      if (availabilityError) throw availabilityError;
      setAvailability(availabilityData || []);
    } catch (error) {
      console.error('Error fetching availability data:', error);
    } finally {
      setLoading(false);
    }
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const labelWidth = 90;
  const colWidth = containerWidth > 0 ? (containerWidth - labelWidth) / dateRange.length : 50;

  const getRoomBookings = (room: Room) => {
    const startStr = toDateString(dateRange[0]);
    const endStr = toDateString(dateRange[dateRange.length - 1]);
    return bookings.filter(b => {
      if (b.room_id !== room.id) return false;
      if (b.status === 'needs_review') {
        if (!b.hold_expires_at) return false;
        if (new Date(b.hold_expires_at) <= new Date()) return false;
      }
      return b.check_in <= endStr && b.check_out > startStr;
    });
  };

  const getDateIndex = (dateStr: string): number => {
    const startStr = toDateString(dateRange[0]);
    if (dateStr < startStr) return 0;
    const endStr = toDateString(dateRange[dateRange.length - 1]);
    if (dateStr > endStr) return dateRange.length;
    return dateRange.findIndex(d => toDateString(d) === dateStr);
  };

  if (!selectedProperty) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          Room Availability (7 Days)
        </CardTitle>
        <Button 
          variant="link" 
          className="text-primary text-sm px-0"
          onClick={() => navigate('/availability')}
        >
          View Full <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </CardHeader>
      <CardContent className="px-2 sm:px-4">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            No rooms found for this property
          </div>
        ) : (
          <TooltipProvider>
            <div ref={containerRef} className="overflow-x-auto scrollbar-thin -mx-2 sm:mx-0">
              <div style={{ width: '100%' }}>
                {/* Header */}
                <div className="flex border-b">
                  <div style={{ width: labelWidth }} className="shrink-0 p-1.5 text-xs font-medium text-muted-foreground sticky left-0 bg-card z-10">
                    Room
                  </div>
                  {dateRange.map(date => (
                    <div
                      key={date.toISOString()}
                      className={cn(
                        "text-center flex-1 min-w-0",
                        isToday(date) && "bg-primary/5"
                      )}
                    >
                      <div className="text-[10px] text-muted-foreground">{format(date, 'EEE')}</div>
                      <div className={cn(
                        "text-sm",
                        isToday(date) && "text-primary font-bold"
                      )}>
                        {format(date, 'd')}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Room rows */}
                {rooms.slice(0, 8).map(room => {
                  const roomBookings = getRoomBookings(room);
                  const roomBlocks = availability.filter(a => a.room_id === room.id && !a.is_available);

                  return (
                    <div key={room.id} className="flex border-b hover:bg-muted/20 transition-colors relative" style={{ height: 36 }}>
                      <div style={{ width: labelWidth }} className="shrink-0 p-1.5 sticky left-0 bg-card z-10 flex items-center">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="font-medium text-xs truncate">{room.room_number}</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{room.room_number} – {room.room_type}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>

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

                        {/* Booking bars */}
                        {roomBookings.map(booking => {
                          const startIdx = Math.max(0, getDateIndex(booking.check_in));
                          const endIdx = Math.min(dateRange.length, getDateIndex(booking.check_out));
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
                                  style={{ left: left + 2, width: Math.max(width, 16), top: 3, bottom: 3 }}
                                  onClick={() => navigate(`/bookings/${booking.id}`)}
                                />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="font-medium">{booking.guest?.name || 'Guest'}</p>
                                <p className="text-xs">{barType}</p>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}

                        {/* Blocks */}
                        {roomBlocks.map(block => {
                          const idx = getDateIndex(block.date);
                          if (idx < 0) return null;
                          return (
                            <Tooltip key={block.id}>
                              <TooltipTrigger asChild>
                                <div
                                  className="gantt-bar gantt-bar-blocked"
                                  style={{ left: idx * colWidth + 2, width: colWidth - 4, top: 3, bottom: 3 }}
                                />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{block.blocked_reason || 'Blocked'}</p>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              {rooms.length > 8 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  +{rooms.length - 8} more rooms
                </p>
              )}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 mt-3 pt-2 border-t">
              {[
                { cls: 'gantt-bar-reserved', label: 'Reserved' },
                { cls: 'gantt-bar-occupied', label: 'Occupied' },
                { cls: 'gantt-bar-held', label: 'Held' },
                { cls: 'gantt-bar-blocked', label: 'Blocked' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <div className={cn("w-6 h-3 rounded-sm", item.cls)} />
                  <span className="text-[11px] text-muted-foreground">{item.label}</span>
                </div>
              ))}
            </div>
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  );
}

import { useState, useEffect, useMemo } from 'react';
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
import { toast } from 'sonner';
import { addDays, eachDayOfInterval, isToday, isWeekend, format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toDateString } from '@/lib/dateUtils';
import { getCellStatus, cellStatusClass, filterRoomBookings, type CellStatus } from '@/lib/calendarCellStatus';

interface Room {
  id: string;
  room_number: string;
  room_type: string;
  status: string;
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
}

export function DashboardAvailabilityCalendar() {
  const navigate = useNavigate();
  const { selectedProperty } = useProperty();
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [availability, setAvailability] = useState<RoomAvailability[]>([]);

  const dateRange = useMemo(() => {
    const start = new Date();
    const end = addDays(start, 6);
    return eachDayOfInterval({ start, end });
  }, []);

  const rangeStart = useMemo(() => toDateString(dateRange[0]), [dateRange]);
  const rangeEnd = useMemo(() => toDateString(dateRange[dateRange.length - 1]), [dateRange]);

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
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('id, room_number, room_type, status, housekeeping_status, cleaning_until')
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
        .select('id, room_id, date, is_available, blocked_reason')
        .in('room_id', (roomData || []).map(r => r.id))
        .gte('date', rangeStart)
        .lte('date', rangeEnd);

      if (availabilityError) throw availabilityError;
      setAvailability(availabilityData || []);
    } catch (error) {
      console.error('Error fetching availability data:', error);
      toast.error('Failed to load availability data');
    } finally {
      setLoading(false);
    }
  };

  if (!selectedProperty) return null;

  const renderCellTooltip = (status: CellStatus, dateStr: string) => {
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
            <div className="overflow-x-auto scrollbar-thin -mx-2 sm:mx-0">
              {/* Header */}
              <div className="grid" style={{ gridTemplateColumns: `${isMobile ? '60px' : '90px'} repeat(${dateRange.length}, 1fr)` }}>
                <div className="p-1 sm:p-1.5 text-[10px] sm:text-xs font-medium text-muted-foreground sticky left-0 bg-card z-10 border-b">
                  Room
                </div>
                {dateRange.map(date => (
                  <div
                    key={date.toISOString()}
                    className={cn(
                      "text-center border-b",
                      isToday(date) && "bg-primary/5"
                    )}
                  >
                    <div className="text-[9px] sm:text-[10px] text-muted-foreground">{format(date, 'EEE')}</div>
                    <div className={cn(
                      "text-xs sm:text-sm",
                      isToday(date) && "text-primary font-bold"
                    )}>
                      {format(date, 'd')}
                    </div>
                  </div>
                ))}

                {/* Room rows */}
                {rooms.slice(0, 8).map(room => {
                  const roomBookings = filterRoomBookings(bookings, room.id, rangeStart, rangeEnd);
                  const roomBlocks = availability.filter(a => a.room_id === room.id && !a.is_available);

                  return (
                    <>
                      <div key={`label-${room.id}`} className="p-1 sm:p-1.5 sticky left-0 bg-card z-10 flex items-center border-b">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="font-medium text-xs truncate">{room.room_number}</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{room.room_number} – {room.room_type}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      {dateRange.map(date => {
                        const dateStr = toDateString(date);
                        const status = getCellStatus(dateStr, room, roomBookings, roomBlocks);
                        const statusCls = cellStatusClass(status.type);
                        const isClickable = !!status.booking;

                        const cell = (
                          <div
                            key={`${room.id}-${dateStr}`}
                            className={cn(
                              "border-b border-r h-7 sm:h-9 transition-colors",
                              isWeekend(date) && "weekend-col",
                              isToday(date) && "today-line",
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
                            {renderCellTooltip(status, dateStr)}
                          </Tooltip>
                        );
                      })}
                    </>
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
            <div className="flex flex-wrap gap-2 sm:gap-3 mt-2 sm:mt-3 pt-2 border-t">
              {[
                { cls: 'cell-reserved', label: 'Reserved' },
                { cls: 'cell-occupied', label: 'Occupied' },
                { cls: 'cell-held', label: 'Held' },
                { cls: 'cell-blocked', label: 'Blocked' },
                { cls: 'cell-cleaning', label: 'Cleaning' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-1">
                  <div className={cn("w-4 sm:w-6 h-2.5 sm:h-3 rounded-sm", item.cls)} />
                  <span className="text-[10px] sm:text-[11px] text-muted-foreground">{item.label}</span>
                </div>
              ))}
            </div>
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  );
}

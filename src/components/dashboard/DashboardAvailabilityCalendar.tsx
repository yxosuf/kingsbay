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
import { format, addDays, eachDayOfInterval, isToday } from 'date-fns';
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

      // Fetch rooms
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('id, room_number, room_type, status')
        .eq('property_id', selectedProperty.id)
        .order('room_number');

      if (roomError) throw roomError;
      setRooms(roomData || []);

      // Fetch bookings for the date range (include needs_review for hold display)
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .select(`
          id,
          room_id,
          check_in,
          check_out,
          status,
          hold_expires_at,
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

      // Fetch room availability blocks
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

  const getCellStatus = (room: Room, date: Date) => {
    const dateStr = toDateString(date);

    // Check for manual blocks
    const block = availability.find(
      a => a.room_id === room.id && a.date === dateStr && !a.is_available
    );
    if (block) {
      return {
        status: 'blocked',
        label: '✕',
        tooltip: block.blocked_reason || 'Blocked',
        className: 'bg-muted text-muted-foreground',
      };
    }

    // Check for bookings using string comparison: [check_in, check_out)
    const booking = bookings.find(b => {
      if (b.room_id !== room.id) return false;
      // needs_review: only block if hold has NOT expired
      if (b.status === 'needs_review') {
        if (!b.hold_expires_at) return false;
        if (new Date(b.hold_expires_at) <= new Date()) return false;
      }
      return isDateInBookingRange(dateStr, b.check_in, b.check_out);
    });

    if (booking) {
      if (booking.status === 'needs_review') {
        return {
          status: 'held',
          label: 'H',
          tooltip: `${booking.guest?.name || 'Guest'} (Hold - Needs Review)`,
          className: 'bg-orange-500/20 text-orange-700 dark:text-orange-400',
        };
      }
      const isOccupied = booking.status === 'checked_in';
      return {
        status: isOccupied ? 'occupied' : 'reserved',
        label: isOccupied ? 'O' : 'R',
        tooltip: `${booking.guest?.name || 'Guest'} (${isOccupied ? 'Occupied' : 'Reserved'})`,
        className: isOccupied
          ? 'bg-destructive/20 text-destructive'
          : 'bg-warning/20 text-warning',
      };
    }

    // Room is in maintenance
    if (room.status === 'maintenance') {
      return {
        status: 'maintenance',
        label: 'M',
        tooltip: 'Maintenance',
        className: 'bg-muted text-muted-foreground',
      };
    }

    return {
      status: 'available',
      label: '✓',
      tooltip: 'Available',
      className: 'bg-success/10 text-success',
    };
  };

  if (!selectedProperty) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
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
      <CardContent className="px-3 sm:px-6">
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
            <div className="overflow-x-auto -mx-3 sm:mx-0">
              <table className="w-full border-collapse min-w-max">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-card z-10 p-1.5 sm:p-2 text-left text-xs font-medium text-muted-foreground w-20 sm:w-24">
                      Room
                    </th>
                    {dateRange.map(date => (
                      <th 
                        key={date.toISOString()} 
                        className={cn(
                          "p-1 sm:p-1.5 text-center text-xs font-medium min-w-[40px] sm:min-w-[50px]",
                          isToday(date) && "bg-primary/10 rounded-t"
                        )}
                      >
                        <div className="text-muted-foreground">{format(date, 'EEE')}</div>
                        <div className={cn(
                          "text-sm sm:text-base",
                          isToday(date) && "text-primary font-bold"
                        )}>
                          {format(date, 'd')}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rooms.slice(0, 8).map(room => (
                    <tr key={room.id} className="hover:bg-muted/30">
                      <td className="sticky left-0 bg-card z-10 p-1.5 sm:p-2 border-t">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="truncate max-w-[70px] sm:max-w-[80px]">
                              <span className="font-medium text-sm">{room.room_number}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{room.room_number} - {room.room_type}</p>
                          </TooltipContent>
                        </Tooltip>
                      </td>
                      {dateRange.map(date => {
                        const cell = getCellStatus(room, date);
                        return (
                          <td 
                            key={date.toISOString()} 
                            className={cn(
                              "p-0.5 sm:p-1 border-t text-center",
                              isToday(date) && "bg-primary/5"
                            )}
                          >
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div 
                                  className={cn(
                                    "h-6 sm:h-7 rounded flex items-center justify-center text-xs font-medium cursor-default",
                                    cell.className
                                  )}
                                >
                                  {cell.label}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{cell.tooltip}</p>
                              </TooltipContent>
                            </Tooltip>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rooms.length > 8 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  +{rooms.length - 8} more rooms
                </p>
              )}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-3 sm:gap-4 mt-3 pt-3 border-t">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded bg-success/10 flex items-center justify-center text-success text-xs">✓</div>
                <span className="text-xs text-muted-foreground">Available</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded bg-warning/20 flex items-center justify-center text-warning text-xs">R</div>
                <span className="text-xs text-muted-foreground">Reserved</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded bg-destructive/20 flex items-center justify-center text-destructive text-xs">O</div>
                <span className="text-xs text-muted-foreground">Occupied</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded bg-muted flex items-center justify-center text-muted-foreground text-xs">✕</div>
                <span className="text-xs text-muted-foreground">Blocked</span>
              </div>
            </div>
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  );
}

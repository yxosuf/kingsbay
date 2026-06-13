import { supabase } from '@/integrations/supabase/client';
import { format, eachDayOfInterval } from 'date-fns';

interface AvailabilityResult {
  isAvailable: boolean;
  conflictingBookings: {
    id: string;
    checkIn: string;
    checkOut: string;
    guestName: string;
  }[];
  blockedDates: {
    date: string;
    reason: string;
  }[];
}

/**
 * Check if a room is available for the given date range.
 * This is the conflict detection function used before confirming bookings.
 */
export async function checkRoomAvailability(
  roomId: string,
  checkIn: Date,
  checkOut: Date,
  excludeBookingId?: string
): Promise<AvailabilityResult> {
  const result: AvailabilityResult = {
    isAvailable: true,
    conflictingBookings: [],
    blockedDates: [],
  };

  const checkInStr = format(checkIn, 'yyyy-MM-dd');
  const checkOutStr = format(checkOut, 'yyyy-MM-dd');

  try {
    // Check for conflicting bookings
    // A booking conflicts if:
    // - The new check-in is before existing check-out AND
    // - The new check-out is after existing check-in
    let bookingQuery = supabase
      .from('bookings')
      .select(`
        id,
        check_in,
        check_out,
        status,
        guest:guests(name)
      `)
      .eq('room_id', roomId)
      .in('status', ['confirmed', 'checked_in', 'pending'])
      .lt('check_in', checkOutStr)
      .gt('check_out', checkInStr);

    // Exclude current booking when editing
    if (excludeBookingId) {
      bookingQuery = bookingQuery.neq('id', excludeBookingId);
    }

    const { data: conflictingBookings, error: bookingsError } = await bookingQuery;

    if (bookingsError) {
      console.error('Error checking booking conflicts:', bookingsError);
      throw bookingsError;
    }

    if (conflictingBookings && conflictingBookings.length > 0) {
      result.isAvailable = false;
      result.conflictingBookings = conflictingBookings.map(b => ({
        id: b.id,
        checkIn: b.check_in,
        checkOut: b.check_out,
        guestName: (Array.isArray(b.guest) ? b.guest[0]?.name : (b.guest as any)?.name) || 'Unknown Guest',
      }));
    }

    // Check for blocked dates in room_availability
    const dates = eachDayOfInterval({ start: checkIn, end: new Date(checkOut.getTime() - 1) });
    const dateStrings = dates.map(d => format(d, 'yyyy-MM-dd'));

    const { data: blockedDates, error: blockedError } = await supabase
      .from('room_availability')
      .select('date, blocked_reason')
      .eq('room_id', roomId)
      .eq('is_available', false)
      .in('date', dateStrings);

    if (blockedError) {
      console.error('Error checking blocked dates:', blockedError);
      throw blockedError;
    }

    if (blockedDates && blockedDates.length > 0) {
      result.isAvailable = false;
      result.blockedDates = blockedDates.map(b => ({
        date: b.date,
        reason: b.blocked_reason || 'Blocked',
      }));
    }
  } catch (error) {
    console.error('Error in availability check:', error);
    // In case of error, assume unavailable for safety
    result.isAvailable = false;
  }

  return result;
}

/**
 * Get availability summary for a property on a specific date.
 * Takes into account safety buffer from inventory settings.
 */
export async function getPropertyAvailability(
  propertyId: string,
  date: Date,
  roomType?: string
): Promise<{
  totalRooms: number;
  availableRooms: number;
  bookedRooms: number;
  blockedRooms: number;
  safetyBuffer: number;
  sellableRooms: number;
}> {
  const dateStr = format(date, 'yyyy-MM-dd');

  // Get all rooms
  let roomQuery = supabase
    .from('rooms')
    .select('id, status')
    .eq('property_id', propertyId);

  if (roomType) {
    roomQuery = roomQuery.eq('room_type', roomType);
  }

  const { data: rooms, error: roomError } = await roomQuery;
  if (roomError) {
    console.error('Error fetching rooms for availability:', roomError);
    throw roomError;
  }
  const totalRooms = rooms?.length || 0;
  const roomIds = rooms?.map(r => r.id) || [];

  if (roomIds.length === 0) {
    return {
      totalRooms: 0,
      availableRooms: 0,
      bookedRooms: 0,
      blockedRooms: 0,
      safetyBuffer: 0,
      sellableRooms: 0,
    };
  }

  // Get bookings for this date
  const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('room_id')
    .in('room_id', roomIds)
    .in('status', ['confirmed', 'checked_in', 'pending'])
    .lte('check_in', dateStr)
    .gt('check_out', dateStr);

  if (bookingsError) {
    console.error('Error fetching bookings for availability:', bookingsError);
    throw bookingsError;
  }

  const bookedRoomIds = new Set(bookings?.map(b => b.room_id) || []);
  const bookedRooms = bookedRoomIds.size;

  // Get blocked dates
  const { data: blocked, error: blockedError } = await supabase
    .from('room_availability')
    .select('room_id')
    .in('room_id', roomIds)
    .eq('date', dateStr)
    .eq('is_available', false);

  if (blockedError) {
    console.error('Error fetching blocked dates for availability:', blockedError);
    throw blockedError;
  }

  const blockedRoomIds = new Set(blocked?.map(b => b.room_id) || []);
  // Don't double count rooms that are both booked and blocked
  const blockedRooms = [...blockedRoomIds].filter(id => !bookedRoomIds.has(id)).length;

  // Get rooms in maintenance
  const maintenanceRooms = rooms?.filter(r => r.status === 'maintenance').length || 0;

  // Get inventory settings for safety buffer
  const { data: settings, error: settingsError } = await supabase
    .from('property_inventory_settings')
    .select('safety_buffer')
    .eq('property_id', propertyId)
    .maybeSingle();

  if (settingsError) {
    console.error('Error fetching inventory settings:', settingsError);
  }

  const safetyBuffer = settings?.safety_buffer || 0;

  const availableRooms = totalRooms - bookedRooms - blockedRooms - maintenanceRooms;
  const sellableRooms = Math.max(0, availableRooms - safetyBuffer);

  return {
    totalRooms,
    availableRooms,
    bookedRooms,
    blockedRooms: blockedRooms + maintenanceRooms,
    safetyBuffer,
    sellableRooms,
  };
}

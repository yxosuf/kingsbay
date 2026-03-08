import { toDateString } from '@/lib/dateUtils';

interface CellRoom {
  id: string;
  housekeeping_status: string;
  cleaning_until: string | null;
  status: string;
}

interface CellBooking {
  id: string;
  room_id: string;
  check_in: string;
  check_out: string;
  status: string;
  hold_expires_at: string | null;
  guest: { name: string };
}

interface CellBlock {
  id: string;
  room_id: string;
  date: string;
  is_available: boolean;
  blocked_reason: string | null;
}

export type CellStatusType = 'available' | 'reserved' | 'occupied' | 'held' | 'blocked' | 'cleaning' | 'maintenance';

export interface CellStatus {
  type: CellStatusType;
  booking?: CellBooking;
  reason?: string | null;
}

/**
 * Determine the visual status of a single date cell for a room.
 * 
 * Visual rule: A booking with check_in=Mar 10, check_out=Mar 11 fills
 * both Mar 10 AND Mar 11 cells (inclusive on both ends).
 * The guest physically occupies the room on check-in day and leaves on check-out day.
 */
export function getCellStatus(
  dateStr: string,
  room: CellRoom,
  roomBookings: CellBooking[],
  roomBlocks: CellBlock[],
): CellStatus {
  // Maintenance rooms are blocked entirely
  if (room.status === 'maintenance') {
    return { type: 'maintenance', reason: 'Maintenance' };
  }

  // Check bookings — visual: [check_in, check_out] inclusive
  const booking = roomBookings.find(b => dateStr >= b.check_in && dateStr <= b.check_out);
  if (booking) {
    if (booking.status === 'checked_in') return { type: 'occupied', booking };
    if (booking.status === 'needs_review') return { type: 'held', booking };
    return { type: 'reserved', booking };
  }

  // Check manual blocks
  const block = roomBlocks.find(b => b.date === dateStr);
  if (block) return { type: 'blocked', reason: block.blocked_reason };

  // Check cleaning (today only)
  const todayStr = toDateString(new Date());
  if (dateStr === todayStr && (room.housekeeping_status === 'cleaning' || room.housekeeping_status === 'dirty')) {
    return { type: 'cleaning', reason: room.housekeeping_status === 'cleaning' ? 'Cleaning in progress' : 'Needs cleaning' };
  }

  return { type: 'available' };
}

/** CSS class for a cell status type */
export function cellStatusClass(type: CellStatusType): string {
  switch (type) {
    case 'reserved': return 'cell-reserved';
    case 'occupied': return 'cell-occupied';
    case 'held': return 'cell-held';
    case 'blocked': return 'cell-blocked';
    case 'maintenance': return 'cell-blocked';
    case 'cleaning': return 'cell-cleaning';
    default: return '';
  }
}

/** Filter bookings for a specific room, excluding expired holds */
export function filterRoomBookings(
  bookings: CellBooking[],
  roomId: string,
  rangeStart: string,
  rangeEnd: string,
): CellBooking[] {
  return bookings.filter(b => {
    if (b.room_id !== roomId) return false;
    if (b.status === 'needs_review') {
      if (!b.hold_expires_at) return false;
      if (new Date(b.hold_expires_at) <= new Date()) return false;
    }
    // Booking overlaps range visually: check_in <= rangeEnd && check_out >= rangeStart
    return b.check_in <= rangeEnd && b.check_out >= rangeStart;
  });
}

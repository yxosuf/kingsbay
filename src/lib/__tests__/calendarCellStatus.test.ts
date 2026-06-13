import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCellStatus, cellStatusClass, filterRoomBookings } from '../calendarCellStatus';
import type { CellStatusType } from '../calendarCellStatus';

// Mock dateUtils to control "today"
vi.mock('../dateUtils', () => ({
  toDateString: () => '2024-03-15',
}));

const makeRoom = (overrides: Partial<{ id: string; housekeeping_status: string; cleaning_until: string | null; status: string }> = {}) => ({
  id: 'room-1',
  housekeeping_status: 'clean',
  cleaning_until: null,
  status: 'available',
  ...overrides,
});

const makeBooking = (overrides: Partial<{
  id: string; room_id: string; check_in: string; check_out: string;
  status: string; hold_expires_at: string | null; guest: { name: string };
}> = {}) => ({
  id: 'booking-1',
  room_id: 'room-1',
  check_in: '2024-03-14',
  check_out: '2024-03-16',
  status: 'confirmed',
  hold_expires_at: null,
  guest: { name: 'Test Guest' },
  ...overrides,
});

describe('getCellStatus', () => {
  it('returns maintenance for rooms in maintenance', () => {
    const room = makeRoom({ status: 'maintenance' });
    const result = getCellStatus('2024-03-15', room, [], []);
    expect(result.type).toBe('maintenance');
    expect(result.reason).toBe('Maintenance');
  });

  it('returns occupied for checked_in booking', () => {
    const booking = makeBooking({ status: 'checked_in' });
    const result = getCellStatus('2024-03-15', makeRoom(), [booking], []);
    expect(result.type).toBe('occupied');
    expect(result.booking).toBe(booking);
  });

  it('returns held for needs_review booking', () => {
    const booking = makeBooking({ status: 'needs_review' });
    const result = getCellStatus('2024-03-15', makeRoom(), [booking], []);
    expect(result.type).toBe('held');
  });

  it('returns reserved for confirmed/pending booking', () => {
    const booking = makeBooking({ status: 'confirmed' });
    const result = getCellStatus('2024-03-15', makeRoom(), [booking], []);
    expect(result.type).toBe('reserved');
  });

  it('returns blocked for manually blocked dates', () => {
    const block = { id: 'b1', room_id: 'room-1', date: '2024-03-15', is_available: false, blocked_reason: 'Renovation' };
    const result = getCellStatus('2024-03-15', makeRoom(), [], [block]);
    expect(result.type).toBe('blocked');
    expect(result.reason).toBe('Renovation');
  });

  it('returns cleaning when today and room is dirty', () => {
    const room = makeRoom({ housekeeping_status: 'dirty' });
    const result = getCellStatus('2024-03-15', room, [], []);
    expect(result.type).toBe('cleaning');
    expect(result.reason).toBe('Needs cleaning');
  });

  it('returns cleaning when today and room is being cleaned', () => {
    const room = makeRoom({ housekeeping_status: 'cleaning' });
    const result = getCellStatus('2024-03-15', room, [], []);
    expect(result.type).toBe('cleaning');
    expect(result.reason).toBe('Cleaning in progress');
  });

  it('does not return cleaning for dirty room on a future date', () => {
    const room = makeRoom({ housekeeping_status: 'dirty' });
    const result = getCellStatus('2024-03-20', room, [], []);
    expect(result.type).toBe('available');
  });

  it('returns available when no conditions match', () => {
    const result = getCellStatus('2024-03-20', makeRoom(), [], []);
    expect(result.type).toBe('available');
  });

  it('booking match is inclusive on check_in and check_out', () => {
    const booking = makeBooking({ check_in: '2024-03-10', check_out: '2024-03-12' });
    expect(getCellStatus('2024-03-10', makeRoom(), [booking], []).type).toBe('reserved');
    expect(getCellStatus('2024-03-12', makeRoom(), [booking], []).type).toBe('reserved');
    expect(getCellStatus('2024-03-13', makeRoom(), [booking], []).type).toBe('available');
  });

  it('prioritizes maintenance over bookings', () => {
    const room = makeRoom({ status: 'maintenance' });
    const booking = makeBooking();
    const result = getCellStatus('2024-03-15', room, [booking], []);
    expect(result.type).toBe('maintenance');
  });

  it('prioritizes bookings over blocks', () => {
    const booking = makeBooking();
    const block = { id: 'b1', room_id: 'room-1', date: '2024-03-15', is_available: false, blocked_reason: 'Test' };
    const result = getCellStatus('2024-03-15', makeRoom(), [booking], [block]);
    expect(result.type).toBe('reserved');
  });
});

describe('cellStatusClass', () => {
  const cases: [CellStatusType, string][] = [
    ['reserved', 'cell-reserved'],
    ['occupied', 'cell-occupied'],
    ['held', 'cell-held'],
    ['blocked', 'cell-blocked'],
    ['maintenance', 'cell-blocked'],
    ['cleaning', 'cell-cleaning'],
    ['available', ''],
  ];

  it.each(cases)('returns "%s" → "%s"', (type, expected) => {
    expect(cellStatusClass(type)).toBe(expected);
  });
});

describe('filterRoomBookings', () => {
  const rangeStart = '2024-03-10';
  const rangeEnd = '2024-03-20';

  it('filters by room_id', () => {
    const b1 = makeBooking({ room_id: 'room-1' });
    const b2 = makeBooking({ id: 'b2', room_id: 'room-2' });
    const result = filterRoomBookings([b1, b2], 'room-1', rangeStart, rangeEnd);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('booking-1');
  });

  it('excludes needs_review bookings without hold_expires_at', () => {
    const b = makeBooking({ status: 'needs_review', hold_expires_at: null });
    expect(filterRoomBookings([b], 'room-1', rangeStart, rangeEnd)).toHaveLength(0);
  });

  it('excludes needs_review bookings with expired hold', () => {
    const b = makeBooking({ status: 'needs_review', hold_expires_at: '2020-01-01T00:00:00Z' });
    expect(filterRoomBookings([b], 'room-1', rangeStart, rangeEnd)).toHaveLength(0);
  });

  it('includes needs_review bookings with future hold', () => {
    const b = makeBooking({ status: 'needs_review', hold_expires_at: '2099-01-01T00:00:00Z' });
    expect(filterRoomBookings([b], 'room-1', rangeStart, rangeEnd)).toHaveLength(1);
  });

  it('excludes bookings outside the range', () => {
    const b = makeBooking({ check_in: '2024-01-01', check_out: '2024-01-05' });
    expect(filterRoomBookings([b], 'room-1', rangeStart, rangeEnd)).toHaveLength(0);
  });

  it('includes bookings overlapping the range start', () => {
    const b = makeBooking({ check_in: '2024-03-08', check_out: '2024-03-12' });
    expect(filterRoomBookings([b], 'room-1', rangeStart, rangeEnd)).toHaveLength(1);
  });

  it('includes bookings overlapping the range end', () => {
    const b = makeBooking({ check_in: '2024-03-18', check_out: '2024-03-22' });
    expect(filterRoomBookings([b], 'room-1', rangeStart, rangeEnd)).toHaveLength(1);
  });
});

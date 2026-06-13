import { describe, it, expect } from 'vitest';
import { parseLocalDate, toDateString, isDateInBookingRange } from '../dateUtils';

describe('parseLocalDate', () => {
  it('parses YYYY-MM-DD into a local midnight Date', () => {
    const date = parseLocalDate('2024-03-15');
    expect(date.getFullYear()).toBe(2024);
    expect(date.getMonth()).toBe(2); // 0-indexed
    expect(date.getDate()).toBe(15);
    expect(date.getHours()).toBe(0);
    expect(date.getMinutes()).toBe(0);
  });

  it('handles single-digit months and days', () => {
    const date = parseLocalDate('2024-01-05');
    expect(date.getFullYear()).toBe(2024);
    expect(date.getMonth()).toBe(0);
    expect(date.getDate()).toBe(5);
  });

  it('handles end-of-year dates', () => {
    const date = parseLocalDate('2024-12-31');
    expect(date.getMonth()).toBe(11);
    expect(date.getDate()).toBe(31);
  });

  it('handles leap year Feb 29', () => {
    const date = parseLocalDate('2024-02-29');
    expect(date.getMonth()).toBe(1);
    expect(date.getDate()).toBe(29);
  });
});

describe('toDateString', () => {
  it('formats a Date to YYYY-MM-DD', () => {
    const date = new Date(2024, 2, 15); // March 15
    expect(toDateString(date)).toBe('2024-03-15');
  });

  it('zero-pads single-digit months and days', () => {
    const date = new Date(2024, 0, 5); // Jan 5
    expect(toDateString(date)).toBe('2024-01-05');
  });

  it('roundtrips with parseLocalDate', () => {
    const original = '2024-07-04';
    expect(toDateString(parseLocalDate(original))).toBe(original);
  });

  it('handles Dec 31', () => {
    const date = new Date(2024, 11, 31);
    expect(toDateString(date)).toBe('2024-12-31');
  });
});

describe('isDateInBookingRange', () => {
  const checkIn = '2024-03-10';
  const checkOut = '2024-03-13';

  it('returns true for the check-in date', () => {
    expect(isDateInBookingRange('2024-03-10', checkIn, checkOut)).toBe(true);
  });

  it('returns true for a date in the middle of the stay', () => {
    expect(isDateInBookingRange('2024-03-11', checkIn, checkOut)).toBe(true);
  });

  it('returns true for the day before checkout', () => {
    expect(isDateInBookingRange('2024-03-12', checkIn, checkOut)).toBe(true);
  });

  it('returns false for the checkout date (exclusive)', () => {
    expect(isDateInBookingRange('2024-03-13', checkIn, checkOut)).toBe(false);
  });

  it('returns false for a date before check-in', () => {
    expect(isDateInBookingRange('2024-03-09', checkIn, checkOut)).toBe(false);
  });

  it('returns false for a date after checkout', () => {
    expect(isDateInBookingRange('2024-03-14', checkIn, checkOut)).toBe(false);
  });

  it('handles single-night stay', () => {
    expect(isDateInBookingRange('2024-03-10', '2024-03-10', '2024-03-11')).toBe(true);
    expect(isDateInBookingRange('2024-03-11', '2024-03-10', '2024-03-11')).toBe(false);
  });
});

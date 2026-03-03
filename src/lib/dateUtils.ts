/**
 * Safe local date parsing utilities.
 * 
 * CRITICAL: Never use `new Date('YYYY-MM-DD')` directly in the frontend.
 * That creates a UTC midnight date which shifts when converted to local time.
 * 
 * Always use these helpers for date-only (DATE) columns from the database.
 */

/**
 * Parse a 'YYYY-MM-DD' string into a local midnight Date object.
 * Avoids timezone shift that occurs with `new Date('2024-03-03')`.
 */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Format a Date to 'YYYY-MM-DD' string using local date parts.
 */
export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Check if a cell date falls within a booking's blocked range.
 * Rule: A stay blocks nights in [check_in, check_out).
 * The checkout date is NOT blocked.
 * 
 * Uses string comparison (YYYY-MM-DD format is lexicographically correct).
 */
export function isDateInBookingRange(cellDateStr: string, checkIn: string, checkOut: string): boolean {
  return cellDateStr >= checkIn && cellDateStr < checkOut;
}

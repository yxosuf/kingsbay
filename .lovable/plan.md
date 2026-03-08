

## Plan: Extend Booking Bar to Include Checkout Date Visually

### Problem
Currently, booking bars use `[check_in, check_out)` for their visual width — a 1-night stay (check-in today, check-out tomorrow) only fills 1 block. The user wants the bar to visually span through the checkout date too (2 blocks for a 1-night stay), because the room is physically occupied on checkout morning until 11 AM.

### Important Distinction
- **Availability/overlap logic** stays `[check_in, check_out)` — no change to booking validation or availability checks
- **Visual calendar bars only** extend to include the checkout date

### Changes

**1. `src/components/dashboard/DashboardAvailabilityCalendar.tsx`**
- Change booking bar `endIdx` from `getDateIndex(booking.check_out)` to `getDateIndex(booking.check_out) + 1` (clamped to `dateRange.length`)
- This makes the bar visually span the checkout date column

**2. `src/pages/AvailabilityCalendar.tsx`**
- Same change: booking bar `endIdx` becomes `Math.min(dateRange.length, getDateIndex(booking.check_out) + 1)`

### Result
A 1-night stay (e.g., check-in Mar 8, check-out Mar 9) will visually fill 2 blocks (Mar 8 and Mar 9). The checkout date block shows the room is still occupied until checkout time. After checkout, the cleaning indicator takes over on that cell.

No database, RLS, or availability logic changes needed — this is purely a visual rendering adjustment.




## Fix: Dashboard Calendar Not Filling Full Card Width

### Problem
The calendar columns use `Math.floor((containerWidth - labelWidth) / 7)` which truncates pixels, and the date columns use fixed `width` + `flex-shrink-0` — leaving unused space on the right side of the card.

### Solution
Change the date columns from fixed-width to flex-grow so they evenly fill all remaining space after the room label column.

**File:** `src/components/dashboard/DashboardAvailabilityCalendar.tsx`

1. **Header date cells**: Remove `style={{ width: colWidth }}` and `flex-shrink-0`, replace with `flex-1 min-w-0` so each column grows equally to fill the row.

2. **Room row grid cells**: Same change — use `flex-1 min-w-0` instead of fixed width.

3. **Booking bars positioning**: Since bars use absolute positioning with `left` and `width` calculated from `colWidth`, keep `colWidth` for bar math but compute it as `(containerWidth - labelWidth) / dateRange.length` (no `Math.floor`) for more accurate positioning. The grid cells themselves use flexbox to fill space naturally.

4. **Block bars**: Same colWidth-based positioning fix.

This ensures the 7 date columns always stretch edge-to-edge regardless of card width, matching the reference screenshot.


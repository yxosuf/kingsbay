

## Problem

The user reports the dashboard calendar and availability calendar show bookings on different dates. The root cause is:

1. **Timezone bug in AvailabilityCalendar.tsx**: Lines 102-103 still use `format(dateRange[0], 'yyyy-MM-dd')` instead of the timezone-safe `toDateString()`. This can shift dates by 1 day depending on timezone.
2. **Gantt bar positioning complexity**: The absolute-positioned Gantt bars calculate pixel offsets, which can visually misalign. The user wants a simpler cell-based grid where each date cell is clearly filled or empty.
3. **Visual rule**: A booking with check_in=March 10, check_out=March 13 should fill cells on March 10, 11, 12 AND 13 (checkout date included visually since the guest occupies the room that morning).

## Plan: Rebuild Both Calendars as Cell-Based Grids

Replace the Gantt bar approach with a per-cell coloring system. Each cell in the grid determines its own status (booked/blocked/cleaning/available) and colors itself accordingly. No absolute positioning needed.

### Changes

**`src/pages/AvailabilityCalendar.tsx`** — Full rewrite of the grid rendering:

1. Fix timezone bug: replace `format()` with `toDateString()` for query date strings (lines 102-103).
2. Replace Gantt bar overlay with per-cell status check. For each room row, each date cell determines its status:
   - Check if any booking covers this date: `dateStr >= booking.check_in && dateStr <= booking.check_out` (inclusive of checkout for visual)
   - Check if blocked in `room_availability`
   - Check if cleaning/dirty on today
   - Apply the appropriate background color class directly to the cell
3. Each cell gets a tooltip showing the guest name and dates if booked, or block reason if blocked.
4. Keep all existing features: week/month view, room type filter, inventory summary cards, navigation, legend, low inventory warning.

**`src/components/dashboard/DashboardAvailabilityCalendar.tsx`** — Same cell-based rewrite:

1. Same per-cell status logic as the availability page.
2. Keep compact 7-day view, 8-room limit, legend, and "View Full" link.

**`src/index.css`** — Simplify styles:

1. Keep the color classes (`gantt-bar-reserved`, etc.) but make them work as cell backgrounds instead of absolute-positioned bars.
2. Add new cell status classes: `cell-reserved`, `cell-occupied`, `cell-held`, `cell-blocked`, `cell-cleaning` with the same color schemes.

### Cell Status Logic (shared helper)

```typescript
function getCellStatus(dateStr, room, bookings, blocks) {
  // Check bookings — visual rule: [check_in, check_out] inclusive
  const booking = bookings.find(b => 
    b.room_id === room.id && dateStr >= b.check_in && dateStr <= b.check_out
  );
  if (booking) {
    if (booking.status === 'checked_in') return { type: 'occupied', booking };
    if (booking.status === 'needs_review') return { type: 'held', booking };
    return { type: 'reserved', booking };
  }
  // Check blocks
  const block = blocks.find(b => b.room_id === room.id && b.date === dateStr);
  if (block) return { type: 'blocked', reason: block.blocked_reason };
  // Check cleaning (today only)
  if (dateStr === todayStr && (room.housekeeping_status === 'cleaning' || room.housekeeping_status === 'dirty')) {
    return { type: 'cleaning', room };
  }
  return { type: 'available' };
}
```

### Visual Result

- Each cell is a colored block — no floating bars, no pixel math
- Both calendars use identical logic — no date discrepancy possible
- Check-in March 10, check-out March 11 → 2 cells filled (March 10 and 11)
- Clean, consistent appearance on all screen sizes


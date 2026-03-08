

## Plan: Fix Room Availability in New Booking + Dashboard Calendar Improvements

### Issues Identified

1. **Room filter bug in NewBooking**: `fetchAvailableRooms` only filters by `rooms.status = 'available'` (line 112). This is the *room physical status* (available/maintenance), NOT booking availability. A room with an active guest still has `status = 'available'` in the rooms table -- it should be excluded if it has a conflicting booking for the selected dates.

2. **Dashboard calendar sizing**: The Gantt calendar uses a fixed `colWidth = 50px` and `minWidth`, which doesn't adapt to the card width. Needs to use flexible widths so columns fill the available space.

3. **Calendar date marking**: The check-in/check-out date pickers in NewBooking don't show which dates have existing bookings. Need to add visual indicators (dots/highlights) on dates that have bookings across the property.

---

### 1. Fix Room Availability in NewBooking

**File:** `src/pages/NewBooking.tsx`

**Current:** Fetches all rooms where `status = 'available'` -- ignores active bookings.

**Fix:** When `checkIn` and `checkOut` are selected, also query `bookings` table for conflicting bookings in that date range (status in `confirmed, checked_in, pending, needs_review`), collect their `room_id`s, and filter them out of the room list.

Logic:
```
-- Get rooms with conflicting bookings
SELECT DISTINCT room_id FROM bookings
WHERE property_id = X
  AND status IN ('confirmed','checked_in','pending','needs_review')
  AND check_in < checkOutStr
  AND check_out > checkInStr
```

Filter: `rooms.filter(r => !bookedRoomIds.has(r.id))`

If no dates selected yet, show all rooms (current behavior minus the bug).

---

### 2. Dashboard Calendar Responsive Sizing

**File:** `src/components/dashboard/DashboardAvailabilityCalendar.tsx`

Replace the fixed `colWidth = 50` with a responsive approach:
- Use a ref on the container to measure available width
- Calculate `colWidth = (containerWidth - 90) / 7` (90px for room label column)
- Set `min-width: 0` on the outer container so it fits within the card
- Remove the hardcoded `minWidth` style and use `width: 100%` instead

This ensures the calendar always fills the card regardless of screen size.

---

### 3. Calendar Date Marking in NewBooking

**File:** `src/pages/NewBooking.tsx`

Add booking date indicators to the check-in/check-out Calendar components:

- Fetch all bookings for the selected property (status blocking) to get their check_in/check_out ranges
- Use the Calendar's `modifiers` and `modifiersStyles` props to highlight dates that have bookings
- Show a small colored dot under dates that are booked (using `modifiersClassNames` with a custom CSS class)
- Booked dates are NOT disabled -- they just show a visual indicator so the user knows occupancy

Add a small CSS class for the dot indicator in `index.css`.

---

### Implementation Order
1. Fix `fetchAvailableRooms` to exclude rooms with conflicting bookings
2. Make dashboard calendar responsive
3. Add booking date indicators to NewBooking calendars


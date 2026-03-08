

## Plan: Show Room Cleaning Status on Calendar After Checkout

### Problem
When a guest checks out, the checkout date cell in the calendar shows as empty/available. The user wants to see the room's housekeeping status (cleaning, dirty) on that date so staff can see the room isn't actually ready yet.

### Current Behavior
- Booking bars show `[check_in, check_out)` -- correct, checkout date is not blocked by the booking
- After checkout, the room's `housekeeping_status` is set to `'cleaning'` with a `cleaning_until` timestamp
- But the calendar doesn't read or display this housekeeping info at all

### Changes

**1. DashboardAvailabilityCalendar.tsx**
- Expand Room interface and query to include `housekeeping_status` and `cleaning_until`
- After rendering booking bars and blocks, add a "cleaning" indicator bar on **today's cell** for any room where `housekeeping_status === 'cleaning'` and no active booking covers today
- Add a new `gantt-bar-cleaning` style (e.g., orange/amber hatched) to the legend

**2. AvailabilityCalendar.tsx (full page)**
- Same changes: fetch `housekeeping_status`, `cleaning_until` from rooms
- Render a cleaning bar on today's cell for rooms in cleaning status
- Add "Cleaning" to legend

**3. index.css**
- Add `.gantt-bar-cleaning` style (amber/orange color, distinct from other bar types)

### Logic for cleaning bar
```text
For each room on today's date:
  if room.housekeeping_status === 'cleaning'
    AND no active booking covers today for this room
  → show a single-cell cleaning bar on today
```

This ensures that after checkout, the calendar visually shows the room is being cleaned rather than appearing available.


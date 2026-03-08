

# System Audit & Fix Plan — Kings Bay PMS

## Bugs & Issues Found

### 1. Console Error: `forwardRef` Warning on Dashboard (Index.tsx)
**Issue**: The `Dashboard` component is exported as `export default function Dashboard()` but React Router is trying to pass a ref to it, causing a "Function components cannot be given refs" warning.
**Fix**: Wrap the component export with `React.forwardRef` or convert to a named export that doesn't conflict. Actually, reviewing deeper — the error says "Check the render method of `App`" pointing at `Dashboard`. This is a React Router v6 quirk with lazy components. The fix is to ensure the component is properly exported. This is a warning, not a breaking error, but we should suppress it by wrapping with `forwardRef`.

### 2. Console Error: `forwardRef` Warning in OtherSettings
**Issue**: Same `forwardRef` warning for the `Select` component in `OtherSettings`. This is a Radix UI issue — harmless warning but noisy.
**Fix**: This is a known Radix UI issue, not actionable. Can be ignored.

### 3. Rooms RLS: Front Desk Cannot Update Housekeeping Status
**Issue**: The `rooms` table UPDATE policy only allows `admin` and `manager`. Front desk staff using the Housekeeping Board will get RLS errors when trying to transition rooms or assign staff.
**Fix**: Create a new RLS policy or modify the existing one to allow `front_desk` to update housekeeping-related columns. Since column-level RLS isn't supported in Postgres, we either:
- Add `front_desk` to the rooms UPDATE policy, OR
- Create a security definer function for housekeeping updates only

Best approach: Add `is_write_staff()` to the rooms UPDATE policy so front_desk can update rooms.

### 4. Dashboard: Missing `checked_in_at` Timestamp on Check-In
**Issue**: In `Index.tsx`, `handleCheckIn` updates status to `checked_in` but does NOT set `checked_in_at` timestamp. The BookingDetails page and other flows properly set this.
**Fix**: Add `checked_in_at: new Date().toISOString()` to the update call.

### 5. Dashboard: Sequential API Calls (Performance)
**Issue**: `fetchDashboardData()` makes 6 sequential `await` calls to Supabase. These are independent queries that can be parallelized.
**Fix**: Use `Promise.all()` to run all dashboard queries in parallel, reducing load time significantly.

### 6. Housekeeping Board: Missing Realtime Subscription
**Issue**: The board only refreshes via a 60-second interval. If another staff member transitions a room, it won't update in real-time.
**Fix**: Add a Supabase realtime subscription on the `rooms` table for housekeeping changes.

### 7. Settings Page: `navigate('/auth')` Called During Render
**Issue**: In `Settings.tsx` line 524, `navigate('/auth')` is called directly during render (not inside `useEffect`). This is a React anti-pattern that can cause warnings.
**Fix**: Move the redirect into a `useEffect`.

### 8. FrontDesk/Bookings: No Loading Skeleton for Mobile Cards
**Issue**: Mobile card views show spinner but no skeleton placeholders, causing layout shift.
**Fix**: Add skeleton cards for mobile view during loading state.

### 9. Availability Calendar: `isDateInBookingRange` Import Unused
**Issue**: `isDateInBookingRange` is imported in `AvailabilityCalendar.tsx` but the calendar uses `getCellStatus` from `calendarCellStatus.ts` instead.
**Fix**: Remove unused import.

## Performance Optimizations

### 10. Dashboard Parallel Queries
Combine all 6 independent Supabase queries into a single `Promise.all()`.

### 11. Memoize Expensive Computations
- Housekeeping Board: `getRoomsByStatus` is called multiple times per render — memoize with `useMemo`.
- BookingTable: `parseLocalDate` is called on every render for date formatting — can be memoized.

### 12. Add React.memo to Frequently Re-rendered Components
- `BookingCard`, `StatCard`, `SectionHeader` in FrontDesk
- Room cards in HousekeepingBoard

## Responsive/Mobile Fixes

### 13. Housekeeping Board Mobile Drag-Drop
**Issue**: Drag-and-drop doesn't work on touch devices. The board needs touch event handlers or the forward-transition button as primary mobile interaction.
**Fix**: Ensure the "Next Status" button is prominent on mobile since drag-drop is desktop-only. Already has buttons, so just ensure they're the primary CTA on mobile.

### 14. Settings Page Mobile: Horizontal Scroll Tab Bar Improvements
The mobile tab bar in Settings could benefit from auto-scrolling to the active tab on load.

## Summary of Changes

| # | Fix | Files Affected | Priority |
|---|-----|---------------|----------|
| 1 | Rooms RLS — allow front_desk to update | DB migration | HIGH |
| 2 | Dashboard check-in missing timestamp | Index.tsx | HIGH |
| 3 | Dashboard parallel queries | Index.tsx | HIGH |
| 4 | Settings navigate during render | Settings.tsx | MEDIUM |
| 5 | Housekeeping realtime subscription | HousekeepingBoard.tsx | MEDIUM |
| 6 | Housekeeping memoize getRoomsByStatus | HousekeepingBoard.tsx | LOW |
| 7 | Remove unused import in AvailabilityCalendar | AvailabilityCalendar.tsx | LOW |
| 8 | Update plan.md with final status | .lovable/plan.md | LOW |


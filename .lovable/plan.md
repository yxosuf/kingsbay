

## Problem

The full-page Availability Calendar (`/availability`) has columns that don't stretch to fill the screen width. The date columns use `flex-shrink-0` with a fixed `style={{ width: colWidth }}`, so they stop at ~730px on a 1920px screen, leaving a huge empty gap on the right.

The Dashboard calendar already works correctly because it uses `flex-1 min-w-0` on columns without a fixed width.

## Root Cause

In `AvailabilityCalendar.tsx`:
- Date header cells: `className="... flex-shrink-0"` + `style={{ width: colWidth }}` (line 369-373)
- Date row cells: `className="... flex-shrink-0"` + `style={{ width: colWidth, height: '100%' }}` (line 415-419)
- The inner wrapper has `minWidth` set but no `width: 100%`

The `colWidth` computation on line 248-250 does use `ResizeObserver`, but the `flex-shrink-0` and explicit `width` on each cell prevent the flex container from distributing space.

## Fix

**`src/pages/AvailabilityCalendar.tsx`**:

1. **Header date cells** (line 369): Change `flex-shrink-0` to `flex-1 min-w-0`, remove the inline `style={{ width: colWidth }}`. This matches the dashboard approach.

2. **Row date cells** (line 415): Same change — `flex-1 min-w-0` instead of `flex-shrink-0`, remove the inline width style.

3. **Inner wrapper div** (line 356): Change `minWidth` to `width: '100%'` so it always fills the container. Keep `minWidth` as a fallback for month view where columns may overflow:
   ```
   style={{ width: '100%', minWidth: `${labelWidth + dateRange.length * minColWidth}px` }}
   ```

4. **Gantt bar positioning** stays the same — it already uses `colWidth` from `ResizeObserver` which will compute correctly since the container fills the width.

This makes the full-page calendar visually consistent with the dashboard calendar — columns stretch evenly to fill the available width.


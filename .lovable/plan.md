

# Booking Details Breakdown + Rate Calendar Assessment

## Current State

After reviewing the code:

1. **BookingDetails.tsx** (lines 402-454) — Already renders the nightly breakdown table with rate plan name, but **only** when `price_breakdown` is stored on the booking. Existing bookings created before this column was added will show nothing.

2. **RateCalendar.tsx** — Bulk date selection is **fully implemented** (lines 164-252, 286-305, 424-461). Color coding for Override/Seasonal/Weekend/Closed is working (lines 254-260). Single-cell override editing works for admins.

## What Needs to Be Built

### Add fallback recalculation for existing bookings

For bookings where `price_breakdown` is null (created before the rate engine integration), recalculate the breakdown on-the-fly using `calculateStayTotal` and display it with a note that it reflects current rates, not the original booking rates.

**Changes to `src/pages/BookingDetails.tsx`:**

1. Import `calculateStayTotal` from `@/lib/rateEngine`
2. Add a `useEffect` that fires when booking loads and `price_breakdown` is null
3. Call `calculateStayTotal(propertyId, roomType, roomBasePrice, checkIn, checkOut, ratePlanId, numGuests)` 
4. Store result in local state `calculatedBreakdown`
5. In the render, use `booking.price_breakdown || calculatedBreakdown` for the breakdown table
6. When using `calculatedBreakdown`, show an info badge: "Estimated — based on current rates" to distinguish from immutable stored breakdowns
7. Also display the rate plan name from the booking's `rate_plan_id` by fetching it if not in the stored breakdown

**Also fetch rate plan name independently** — if the booking has `rate_plan_id` but no `price_breakdown`, query `rate_plans` table for the name and display it in the Room & Stay card.

### No changes needed for Rate Calendar

Bulk edit, cell overrides, month navigation, and color coding are all functional.

## Files Modified

| File | Change |
|------|--------|
| `src/pages/BookingDetails.tsx` | Add fallback breakdown recalculation + rate plan name fetch |

No database changes needed.


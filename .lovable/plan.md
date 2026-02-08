

# Fix: Allow Booking Rooms After Guest Checkout

## Problem Identified

When attempting to create a new booking for a room that has a previous **checked-out** guest, the system incorrectly blocks the booking with the error:

> "Room is already booked for these dates. Please choose different dates or another room."

### Root Cause

The database-level conflict detection function `check_booking_overlap()` only excludes bookings with status `cancelled` and `archived`, but **does NOT exclude `checked_out`** bookings.

**Current code (line 87 in the migration)**:
```sql
AND b.status NOT IN ('cancelled', 'archived')
```

This means a room with a checked-out booking from Feb 6-9 will still block a new booking for Feb 8-10, even though the guest has already left.

### Verification

Tested the function directly:
- Room 102 has booking: Feb 6-9, status: `checked_out` (guest: yoosuf)
- Attempting to book Feb 8-10 returns `has_overlap: true` - **incorrect behavior**

## Solution

Update the `check_booking_overlap()` database function to also exclude `checked_out` status from conflict detection.

### Changes Required

**1. Update Database Function**

Modify the `check_booking_overlap` function to exclude `checked_out` bookings:

```sql
-- Change FROM:
AND b.status NOT IN ('cancelled', 'archived')

-- Change TO:
AND b.status NOT IN ('cancelled', 'archived', 'checked_out')
```

**2. Update Trigger Function**

The `prevent_booking_overlap` trigger function (lines 111-113) also needs to skip `checked_out`:

```sql
-- Change FROM:
IF NEW.status IN ('cancelled', 'archived') THEN

-- Change TO:
IF NEW.status IN ('cancelled', 'archived', 'checked_out') THEN
```

### Technical Details

**Database Migration**

Create a new migration that:
1. Replaces `check_booking_overlap()` function with updated status exclusion
2. Replaces `prevent_booking_overlap()` trigger function with updated skip condition

**No Frontend Changes Required**

The frontend `availabilityCheck.ts` already correctly filters to only check `['confirmed', 'checked_in', 'pending']` statuses, so no changes needed there.

### Expected Behavior After Fix

| Booking Status | Blocks New Booking? |
|---------------|---------------------|
| `pending` | Yes |
| `confirmed` | Yes |
| `checked_in` | Yes |
| `checked_out` | **No** (fixed) |
| `cancelled` | No |
| `archived` | No |

### Files to Modify

1. **Create**: New database migration to update both functions

### Testing Plan

After applying the fix:
1. Find a room with a `checked_out` booking
2. Try to create a new booking for overlapping dates
3. Confirm the booking is accepted without error


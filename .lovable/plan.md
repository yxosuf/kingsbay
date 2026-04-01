

# Allow Guests to Add Services to Their Own Bookings

## Problem
Guests currently cannot add services (room service, transport, spa, etc.) to their bookings because:
1. The `services` table RLS only allows `is_staff()` for SELECT — guests can't see available services
2. The `guest_services` table RLS only allows `is_write_staff()` for INSERT — guests can't add services
3. No UI exists in the guest portal for browsing/adding services

## Changes

### 1. Database Migration — Add RLS policies for guest access

```sql
-- Let guests view active services
CREATE POLICY "Guest can view active services"
ON public.services FOR SELECT TO authenticated
USING (is_guest() AND is_active = true);

-- Let guests insert services on their own bookings
CREATE POLICY "Guest can insert own booking services"
ON public.guest_services FOR INSERT TO authenticated
WITH CHECK (
  is_guest() AND booking_id IN (
    SELECT b.id FROM bookings b
    JOIN guests g ON g.id = b.guest_id
    WHERE g.auth_user_id = auth.uid()
  )
);

-- Let guests view services on their own bookings
CREATE POLICY "Guest can view own booking services"
ON public.guest_services FOR SELECT TO authenticated
USING (
  is_guest() AND booking_id IN (
    SELECT b.id FROM bookings b
    JOIN guests g ON g.id = b.guest_id
    WHERE g.auth_user_id = auth.uid()
  )
);
```

### 2. New Component — `src/components/guest/GuestAddServiceDialog.tsx`

A simplified version of the staff `AddServiceDialog`:
- Fetches active services grouped by category
- Guest selects service and quantity
- Unit price is fixed (no custom price override — guests pay listed price)
- Shows total before confirming
- Inserts into `guest_services` with `created_by = null` (guest self-service)

### 3. Update `src/pages/guest/GuestBookingDetails.tsx`

- Fetch and display existing `guest_services` for the booking
- Add "Add Service" button (only for active bookings: `confirmed` or `checked_in`)
- Show services list with name, quantity, total price
- Include the `GuestAddServiceDialog`

### Key Restrictions
- Guests can only add services to their own bookings
- Guests cannot modify the unit price (fixed to catalog price)
- Guests can only add to bookings with status `confirmed` or `checked_in`
- No delete/edit capability for guests (staff-only)


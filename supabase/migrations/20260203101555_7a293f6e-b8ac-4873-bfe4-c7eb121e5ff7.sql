-- Drop the existing permissive SELECT policy on guests
DROP POLICY IF EXISTS "Staff can view all guests" ON public.guests;

-- Create a more restrictive policy: Staff can only view guests who have bookings
-- This prevents staff from viewing the entire guest database
CREATE POLICY "Staff can view guests with bookings"
ON public.guests
FOR SELECT
USING (
  is_staff() AND (
    -- Staff can view guests who have at least one booking
    EXISTS (
      SELECT 1 FROM public.bookings
      WHERE bookings.guest_id = guests.id
    )
    -- OR if the guest was just created (for new booking flow - within last 5 minutes)
    OR created_at > (now() - interval '5 minutes')
  )
);

-- Also update the user_roles policy to be more restrictive
-- Only admins and managers should see all roles, front desk should only see their own
DROP POLICY IF EXISTS "Staff can view all roles" ON public.user_roles;

CREATE POLICY "Users can view own role"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins and managers can view all roles"
ON public.user_roles
FOR SELECT
USING (is_admin() OR is_manager());
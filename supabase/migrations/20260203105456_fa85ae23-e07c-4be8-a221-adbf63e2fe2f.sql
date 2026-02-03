-- Update the guest RLS policy to use role-based access
-- This balances security with operational needs:
-- Admins and managers can view all guests
-- Front desk can only view guests with bookings or recently created

-- First, drop the existing restrictive policy
DROP POLICY IF EXISTS "Staff can view guests with bookings" ON public.guests;

-- Create new role-based guest access policy
CREATE POLICY "Role-based guest access"
ON public.guests FOR SELECT
USING (
  -- Managers and admins can view all guests for operational flexibility
  (is_admin() OR is_manager()) 
  OR 
  -- Front desk can view guests with bookings or created within last 2 hours
  (is_staff() AND (
    EXISTS (SELECT 1 FROM public.bookings WHERE bookings.guest_id = guests.id)
    OR created_at > (now() - interval '2 hours')
  ))
);
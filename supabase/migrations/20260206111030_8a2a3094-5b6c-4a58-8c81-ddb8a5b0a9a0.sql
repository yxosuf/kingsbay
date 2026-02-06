-- Drop the existing overly permissive guest access policy
DROP POLICY IF EXISTS "Role-based guest access" ON public.guests;

-- Create a more restrictive policy:
-- - Admins and Managers: Full access to all guests
-- - Front desk: Only guests with bookings at properties they have access to
CREATE POLICY "Secure guest access by role and property"
ON public.guests
FOR SELECT
USING (
  is_admin() OR is_manager() OR 
  (
    is_front_desk() AND 
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.guest_id = guests.id
      AND (
        -- If front desk has property restrictions, check them
        EXISTS (
          SELECT 1 FROM public.user_property_access upa
          WHERE upa.user_id = auth.uid()
          AND upa.property_id = b.property_id
        )
        OR
        -- If front desk has no property restrictions (access to all), allow
        NOT EXISTS (
          SELECT 1 FROM public.user_property_access
          WHERE user_id = auth.uid()
        )
      )
    )
  )
);
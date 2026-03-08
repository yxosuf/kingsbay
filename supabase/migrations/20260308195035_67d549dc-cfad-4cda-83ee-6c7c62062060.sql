
-- 1. Add ical_export_token column to channel_connections
ALTER TABLE public.channel_connections 
ADD COLUMN IF NOT EXISTS ical_export_token uuid DEFAULT gen_random_uuid();

-- Populate existing rows with tokens
UPDATE public.channel_connections SET ical_export_token = gen_random_uuid() WHERE ical_export_token IS NULL;

-- Make it NOT NULL after populating
ALTER TABLE public.channel_connections ALTER COLUMN ical_export_token SET NOT NULL;

-- Create unique index for token lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_connections_ical_export_token ON public.channel_connections(ical_export_token);

-- 2. Create can_access_guest security definer function
CREATE OR REPLACE FUNCTION public.can_access_guest(guest_property_id uuid, guest_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    -- Admin and Manager: full access
    public.is_admin() OR public.is_manager()
    OR (
      -- Front desk: property-scoped access
      public.is_front_desk() AND (
        -- Guest has a property_id the user can access
        (
          guest_property_id IS NOT NULL
          AND (
            EXISTS (SELECT 1 FROM public.user_property_access upa WHERE upa.user_id = auth.uid() AND upa.property_id = guest_property_id)
            OR NOT EXISTS (SELECT 1 FROM public.user_property_access WHERE user_id = auth.uid())
          )
        )
        OR
        -- Guest has no property_id but has bookings in user's accessible properties
        (
          guest_property_id IS NULL
          AND EXISTS (
            SELECT 1 FROM public.bookings b
            WHERE b.guest_id = can_access_guest.guest_id
            AND (
              EXISTS (SELECT 1 FROM public.user_property_access upa WHERE upa.user_id = auth.uid() AND upa.property_id = b.property_id)
              OR NOT EXISTS (SELECT 1 FROM public.user_property_access WHERE user_id = auth.uid())
            )
          )
        )
      )
    )
    OR (
      -- Viewer: same logic as front_desk for read access
      public.is_viewer() AND (
        (
          guest_property_id IS NOT NULL
          AND (
            EXISTS (SELECT 1 FROM public.user_property_access upa WHERE upa.user_id = auth.uid() AND upa.property_id = guest_property_id)
            OR NOT EXISTS (SELECT 1 FROM public.user_property_access WHERE user_id = auth.uid())
          )
        )
        OR
        (
          guest_property_id IS NULL
          AND EXISTS (
            SELECT 1 FROM public.bookings b
            WHERE b.guest_id = can_access_guest.guest_id
            AND (
              EXISTS (SELECT 1 FROM public.user_property_access upa WHERE upa.user_id = auth.uid() AND upa.property_id = b.property_id)
              OR NOT EXISTS (SELECT 1 FROM public.user_property_access WHERE user_id = auth.uid())
            )
          )
        )
      )
    )
$$;

-- 3. Replace the complex guest SELECT policy with the simpler function
DROP POLICY IF EXISTS "Secure guest access by role and property" ON public.guests;

CREATE POLICY "Secure guest access by role and property"
ON public.guests
FOR SELECT
TO authenticated
USING (public.can_access_guest(property_id, id));

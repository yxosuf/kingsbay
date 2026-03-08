
-- Fix 1: Remove NOT EXISTS fallback from can_access_guest
-- Staff with no property assignments should have NO access, not ALL access
CREATE OR REPLACE FUNCTION public.can_access_guest(guest_property_id uuid, guest_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    public.is_admin() OR public.is_manager()
    OR (
      public.is_front_desk() AND (
        (
          guest_property_id IS NOT NULL
          AND EXISTS (SELECT 1 FROM public.user_property_access upa WHERE upa.user_id = auth.uid() AND upa.property_id = guest_property_id)
        )
        OR
        (
          guest_property_id IS NULL
          AND EXISTS (
            SELECT 1 FROM public.bookings b
            WHERE b.guest_id = can_access_guest.guest_id
            AND EXISTS (SELECT 1 FROM public.user_property_access upa WHERE upa.user_id = auth.uid() AND upa.property_id = b.property_id)
          )
        )
      )
    )
    OR (
      public.is_viewer() AND (
        (
          guest_property_id IS NOT NULL
          AND EXISTS (SELECT 1 FROM public.user_property_access upa WHERE upa.user_id = auth.uid() AND upa.property_id = guest_property_id)
        )
        OR
        (
          guest_property_id IS NULL
          AND EXISTS (
            SELECT 1 FROM public.bookings b
            WHERE b.guest_id = can_access_guest.guest_id
            AND EXISTS (SELECT 1 FROM public.user_property_access upa WHERE upa.user_id = auth.uid() AND upa.property_id = b.property_id)
          )
        )
      )
    )
$$;

-- Fix 2: Remove NOT EXISTS fallback from user_has_notification_access
CREATE OR REPLACE FUNCTION public.user_has_notification_access(notification_target_roles text[], notification_property_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    is_staff()
    AND (
      notification_target_roles IS NULL 
      OR notification_target_roles && ARRAY[(SELECT role::text FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1)]
    )
    AND (
      notification_property_id IS NULL 
      OR EXISTS (SELECT 1 FROM public.user_property_access WHERE user_id = auth.uid() AND property_id = notification_property_id)
    )
$$;

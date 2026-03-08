
-- Fix 1: Restrict channel_connections SELECT to admin/manager only
DROP POLICY IF EXISTS "Staff can view channel connections" ON public.channel_connections;
CREATE POLICY "Admin/Manager can view channel connections"
  ON public.channel_connections
  FOR SELECT
  TO authenticated
  USING (is_admin() OR is_manager());

-- Fix 2: Update user_has_notification_access to bypass property check for admin/manager
CREATE OR REPLACE FUNCTION public.user_has_notification_access(notification_target_roles text[], notification_property_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    CASE
      WHEN is_admin() OR is_manager() THEN TRUE
      ELSE is_staff()
        AND (
          notification_target_roles IS NULL
          OR notification_target_roles && ARRAY[(SELECT role::text FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1)]
        )
        AND (
          notification_property_id IS NULL
          OR EXISTS (SELECT 1 FROM public.user_property_access WHERE user_id = auth.uid() AND property_id = notification_property_id)
        )
    END
$$;

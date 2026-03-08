
-- Add new columns to notifications table
ALTER TABLE public.notifications 
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS target_roles text[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS action_type text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS action_entity_id uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT NULL;

-- Drop existing RLS policies on notifications
DROP POLICY IF EXISTS "Staff can update their notifications" ON public.notifications;
DROP POLICY IF EXISTS "Staff can view notifications for their properties" ON public.notifications;

-- Create a security definer function for role-based notification access
CREATE OR REPLACE FUNCTION public.user_has_notification_access(notification_target_roles text[], notification_property_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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
      OR NOT EXISTS (SELECT 1 FROM public.user_property_access WHERE user_id = auth.uid())
    )
$$;

-- SELECT: Staff can view notifications for their role and property
CREATE POLICY "Staff can view role-based notifications"
ON public.notifications FOR SELECT TO authenticated
USING (
  public.user_has_notification_access(target_roles, property_id)
);

-- UPDATE: Staff can mark notifications as read
CREATE POLICY "Staff can mark notifications read"
ON public.notifications FOR UPDATE TO authenticated
USING (
  public.user_has_notification_access(target_roles, property_id)
)
WITH CHECK (
  public.user_has_notification_access(target_roles, property_id)
);

-- DELETE: Admin can delete notifications
CREATE POLICY "Admin can delete notifications"
ON public.notifications FOR DELETE TO authenticated
USING (is_admin());

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

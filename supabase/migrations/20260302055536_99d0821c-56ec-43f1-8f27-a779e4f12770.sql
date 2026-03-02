
-- 2. Add checkout_time and checkin_time to property_inventory_settings
ALTER TABLE public.property_inventory_settings
  ADD COLUMN IF NOT EXISTS checkout_time time NOT NULL DEFAULT '11:00:00',
  ADD COLUMN IF NOT EXISTS checkin_time time NOT NULL DEFAULT '14:00:00';

-- 3. Create audit_logs table for danger zone actions
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  property_id uuid REFERENCES public.properties(id),
  action text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view audit logs"
  ON public.audit_logs FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Staff can insert audit logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (public.is_staff() AND auth.uid() = user_id);

-- 4. Create is_viewer() function
CREATE OR REPLACE FUNCTION public.is_viewer()
  RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'viewer')
$$;

-- 5. is_staff() already includes viewer via EXISTS on user_roles, no change needed

-- 6. Create the clear_property_data function (SECURITY DEFINER, admin-only)
CREATE OR REPLACE FUNCTION public.clear_property_data(p_property_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  deleted_counts jsonb;
  cnt_payments int;
  cnt_guest_services int;
  cnt_invoices int;
  cnt_bookings int;
  cnt_guests int;
  cnt_availability int;
  cnt_sync_logs int;
  cnt_notifications int;
BEGIN
  -- Verify caller is admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can clear property data';
  END IF;

  -- Delete in correct order respecting foreign keys
  DELETE FROM public.payments WHERE property_id = p_property_id;
  GET DIAGNOSTICS cnt_payments = ROW_COUNT;

  DELETE FROM public.guest_services WHERE property_id = p_property_id;
  GET DIAGNOSTICS cnt_guest_services = ROW_COUNT;

  DELETE FROM public.invoices WHERE property_id = p_property_id;
  GET DIAGNOSTICS cnt_invoices = ROW_COUNT;

  DELETE FROM public.room_availability WHERE room_id IN (
    SELECT id FROM public.rooms WHERE property_id = p_property_id
  );
  GET DIAGNOSTICS cnt_availability = ROW_COUNT;

  DELETE FROM public.sync_logs WHERE channel_id IN (
    SELECT id FROM public.channel_connections WHERE property_id = p_property_id
  );
  GET DIAGNOSTICS cnt_sync_logs = ROW_COUNT;

  DELETE FROM public.bookings WHERE property_id = p_property_id;
  GET DIAGNOSTICS cnt_bookings = ROW_COUNT;

  DELETE FROM public.guest_view_logs WHERE property_id = p_property_id;

  DELETE FROM public.guests WHERE property_id = p_property_id;
  GET DIAGNOSTICS cnt_guests = ROW_COUNT;

  DELETE FROM public.notifications WHERE property_id = p_property_id;
  GET DIAGNOSTICS cnt_notifications = ROW_COUNT;

  DELETE FROM public.email_ingest_logs WHERE property_id = p_property_id;

  deleted_counts := jsonb_build_object(
    'payments', cnt_payments,
    'guest_services', cnt_guest_services,
    'invoices', cnt_invoices,
    'bookings', cnt_bookings,
    'guests', cnt_guests,
    'room_availability', cnt_availability,
    'sync_logs', cnt_sync_logs,
    'notifications', cnt_notifications
  );

  RETURN deleted_counts;
END;
$$;

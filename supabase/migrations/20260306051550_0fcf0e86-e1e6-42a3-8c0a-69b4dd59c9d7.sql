-- 1) Create is_write_staff() function that excludes viewer role
CREATE OR REPLACE FUNCTION public.is_write_staff()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'manager', 'front_desk')
  )
$$;

-- 2) Fix RLS policies: UPDATE INSERT on bookings should use is_write_staff()
DROP POLICY IF EXISTS "Staff can insert bookings" ON public.bookings;
CREATE POLICY "Staff can insert bookings" ON public.bookings
  FOR INSERT TO authenticated WITH CHECK (is_write_staff());

DROP POLICY IF EXISTS "Staff can update bookings" ON public.bookings;
CREATE POLICY "Staff can update bookings" ON public.bookings
  FOR UPDATE TO authenticated USING (is_write_staff());

-- 3) Fix guests INSERT/UPDATE
DROP POLICY IF EXISTS "Staff can insert guests" ON public.guests;
CREATE POLICY "Staff can insert guests" ON public.guests
  FOR INSERT TO authenticated WITH CHECK (is_write_staff());

DROP POLICY IF EXISTS "Staff can update guests" ON public.guests;
CREATE POLICY "Staff can update guests" ON public.guests
  FOR UPDATE TO authenticated USING (is_write_staff());

-- 4) Fix guest_services INSERT/UPDATE
DROP POLICY IF EXISTS "Staff can insert guest services" ON public.guest_services;
CREATE POLICY "Staff can insert guest services" ON public.guest_services
  FOR INSERT TO authenticated WITH CHECK (is_write_staff());

DROP POLICY IF EXISTS "Staff can update guest services" ON public.guest_services;
CREATE POLICY "Staff can update guest services" ON public.guest_services
  FOR UPDATE TO authenticated USING (is_write_staff());

-- 5) Fix invoices INSERT/UPDATE
DROP POLICY IF EXISTS "Staff can insert invoices" ON public.invoices;
CREATE POLICY "Staff can insert invoices" ON public.invoices
  FOR INSERT TO authenticated WITH CHECK (is_write_staff());

DROP POLICY IF EXISTS "Staff can update invoices" ON public.invoices;
CREATE POLICY "Staff can update invoices" ON public.invoices
  FOR UPDATE TO authenticated USING (is_write_staff());

-- 6) Fix payments INSERT/UPDATE
DROP POLICY IF EXISTS "Staff can insert payments" ON public.payments;
CREATE POLICY "Staff can insert payments" ON public.payments
  FOR INSERT TO authenticated WITH CHECK (is_write_staff());

DROP POLICY IF EXISTS "Staff can update payments" ON public.payments;
CREATE POLICY "Staff can update payments" ON public.payments
  FOR UPDATE TO authenticated USING (is_write_staff());

-- 7) Fix room_availability INSERT/UPDATE
DROP POLICY IF EXISTS "Staff can insert room availability" ON public.room_availability;
CREATE POLICY "Staff can insert room availability" ON public.room_availability
  FOR INSERT TO authenticated WITH CHECK (is_write_staff());

DROP POLICY IF EXISTS "Staff can update room availability" ON public.room_availability;
CREATE POLICY "Staff can update room availability" ON public.room_availability
  FOR UPDATE TO authenticated USING (is_write_staff());

-- 8) Fix email_ingest_logs INSERT/UPDATE
DROP POLICY IF EXISTS "Staff can insert email logs" ON public.email_ingest_logs;
CREATE POLICY "Staff can insert email logs" ON public.email_ingest_logs
  FOR INSERT TO authenticated WITH CHECK (is_write_staff());

DROP POLICY IF EXISTS "Staff can update email logs" ON public.email_ingest_logs;
CREATE POLICY "Staff can update email logs" ON public.email_ingest_logs
  FOR UPDATE TO authenticated USING (is_write_staff());

-- 9) Fix audit_logs INSERT (keep condition that user_id = auth.uid())
DROP POLICY IF EXISTS "Staff can insert audit logs" ON public.audit_logs;
CREATE POLICY "Staff can insert audit logs" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (is_write_staff() AND (auth.uid() = user_id));

-- 10) Fix sync_logs INSERT
DROP POLICY IF EXISTS "System can insert sync logs" ON public.sync_logs;
CREATE POLICY "System can insert sync logs" ON public.sync_logs
  FOR INSERT TO authenticated WITH CHECK (is_write_staff());

-- 11) Fix guest_view_logs INSERT (keep user_id check)
DROP POLICY IF EXISTS "Staff can insert guest view logs" ON public.guest_view_logs;
CREATE POLICY "Staff can insert guest view logs" ON public.guest_view_logs
  FOR INSERT TO authenticated WITH CHECK (is_write_staff() AND (auth.uid() = user_id));

-- 12) Fix notifications UPDATE
DROP POLICY IF EXISTS "Staff can update their notifications" ON public.notifications;
CREATE POLICY "Staff can update their notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (is_write_staff()) WITH CHECK (is_write_staff());

-- 13) Add fx_usd_lkr_rate and fx_updated_at to property_inventory_settings
ALTER TABLE public.property_inventory_settings 
  ADD COLUMN IF NOT EXISTS fx_usd_lkr_rate numeric DEFAULT 310,
  ADD COLUMN IF NOT EXISTS fx_updated_at timestamptz;

-- 14) Add archived_at to guests
ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 15) Add cleaning timer fields to rooms
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS auto_cleaning_minutes integer DEFAULT 90,
  ADD COLUMN IF NOT EXISTS cleaning_until timestamptz;
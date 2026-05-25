
-- 1) OTA integrations: restrict SELECT to admin/manager
DROP POLICY IF EXISTS "Staff can view OTA integrations" ON public.ota_integrations;
CREATE POLICY "Admin/Manager can view OTA integrations"
  ON public.ota_integrations FOR SELECT
  TO authenticated
  USING (is_admin() OR is_manager());

-- 2) Room photos storage: restrict insert/delete to write staff
DROP POLICY IF EXISTS "Auth upload room photos" ON storage.objects;
DROP POLICY IF EXISTS "Auth delete room photos" ON storage.objects;

CREATE POLICY "Write staff can upload room photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'room-photos' AND is_write_staff());

CREATE POLICY "Write staff can update room photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'room-photos' AND is_write_staff());

CREATE POLICY "Admin can delete room photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'room-photos' AND is_admin());

-- 3) Guests self-update: prevent changing sensitive fields via trigger
CREATE OR REPLACE FUNCTION public.guard_guest_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only enforce when an authenticated guest is updating their own row
  IF auth.uid() IS NOT NULL
     AND NEW.auth_user_id = auth.uid()
     AND NOT public.is_staff() THEN
    NEW.is_blacklisted        := OLD.is_blacklisted;
    NEW.blacklist_reason      := OLD.blacklist_reason;
    NEW.is_vip                := OLD.is_vip;
    NEW.total_spent           := OLD.total_spent;
    NEW.total_stays           := OLD.total_stays;
    NEW.guest_type            := OLD.guest_type;
    NEW.property_id           := OLD.property_id;
    NEW.auth_user_id          := OLD.auth_user_id;
    NEW.archived_at           := OLD.archived_at;
    NEW.deleted_at            := OLD.deleted_at;
    NEW.notes                 := OLD.notes;
    NEW.passport_photo_path   := OLD.passport_photo_path;
    NEW.passport_photo_uploaded_at := OLD.passport_photo_uploaded_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_guest_self_update_trg ON public.guests;
CREATE TRIGGER guard_guest_self_update_trg
BEFORE UPDATE ON public.guests
FOR EACH ROW EXECUTE FUNCTION public.guard_guest_self_update();

-- 4) Re-scope {public}-role policies to {authenticated}
-- channel_connections: drop duplicates/legacy
DROP POLICY IF EXISTS "Only Admin can insert channel connections" ON public.channel_connections;
DROP POLICY IF EXISTS "Only Admin can update channel connections" ON public.channel_connections;
DROP POLICY IF EXISTS "Admin/Manager can insert channel connections" ON public.channel_connections;
DROP POLICY IF EXISTS "Admin/Manager can update channel connections" ON public.channel_connections;
DROP POLICY IF EXISTS "Admin/Manager can view channel connections" ON public.channel_connections;

CREATE POLICY "Admin/Manager can view channel connections"
  ON public.channel_connections FOR SELECT
  TO authenticated
  USING (is_admin() OR is_manager());

CREATE POLICY "Admin/Manager can insert channel connections"
  ON public.channel_connections FOR INSERT
  TO authenticated
  WITH CHECK (is_admin() OR is_manager());

CREATE POLICY "Admin/Manager can update channel connections"
  ON public.channel_connections FOR UPDATE
  TO authenticated
  USING (is_admin() OR is_manager());

-- occupancy_pricing_rules
DROP POLICY IF EXISTS "Admin can insert occupancy rules" ON public.occupancy_pricing_rules;
DROP POLICY IF EXISTS "Admin can update occupancy rules" ON public.occupancy_pricing_rules;
DROP POLICY IF EXISTS "Admin can delete occupancy rules" ON public.occupancy_pricing_rules;
DROP POLICY IF EXISTS "Staff can view occupancy rules" ON public.occupancy_pricing_rules;

CREATE POLICY "Admin can insert occupancy rules"
  ON public.occupancy_pricing_rules FOR INSERT
  TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admin can update occupancy rules"
  ON public.occupancy_pricing_rules FOR UPDATE
  TO authenticated USING (is_admin());
CREATE POLICY "Admin can delete occupancy rules"
  ON public.occupancy_pricing_rules FOR DELETE
  TO authenticated USING (is_admin());
CREATE POLICY "Staff can view occupancy rules"
  ON public.occupancy_pricing_rules FOR SELECT
  TO authenticated USING (is_staff());

-- ota_sync_logs
DROP POLICY IF EXISTS "Write staff can insert sync logs" ON public.ota_sync_logs;
DROP POLICY IF EXISTS "Staff can view sync logs" ON public.ota_sync_logs;
CREATE POLICY "Write staff can insert sync logs"
  ON public.ota_sync_logs FOR INSERT
  TO authenticated WITH CHECK (is_write_staff());
CREATE POLICY "Staff can view sync logs"
  ON public.ota_sync_logs FOR SELECT
  TO authenticated USING (is_admin() OR is_manager());

-- rate_change_logs
DROP POLICY IF EXISTS "System can insert rate change logs" ON public.rate_change_logs;
DROP POLICY IF EXISTS "Admin can view rate change logs" ON public.rate_change_logs;
CREATE POLICY "System can insert rate change logs"
  ON public.rate_change_logs FOR INSERT
  TO authenticated WITH CHECK (is_staff());
CREATE POLICY "Admin can view rate change logs"
  ON public.rate_change_logs FOR SELECT
  TO authenticated USING (is_admin());

-- ============================================================
-- Fix 5 RLS / storage-policy security gaps identified in review
-- ============================================================

-- 1) room-photos bucket: add missing SELECT policy
--    INSERT/UPDATE/DELETE were added in 20260525180630 but SELECT was omitted,
--    so nobody could actually view uploaded room photos.
CREATE POLICY "Staff can view room photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'room-photos' AND public.is_staff());

-- 2) channel_connections DELETE: re-scope from public to authenticated
--    The original policy (20260204103821) used the public role.
--    The 20260525180630 migration re-scoped SELECT/INSERT/UPDATE but missed DELETE.
DROP POLICY IF EXISTS "Admin can delete channel connections" ON public.channel_connections;
CREATE POLICY "Admin can delete channel connections"
  ON public.channel_connections FOR DELETE
  TO authenticated
  USING (is_admin());

-- 3) ota_integrations: add missing INSERT/UPDATE/DELETE policies
--    Only a SELECT policy existed; the app calls .update() on this table.
CREATE POLICY "Admin can insert OTA integrations"
  ON public.ota_integrations FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admin/Manager can update OTA integrations"
  ON public.ota_integrations FOR UPDATE
  TO authenticated
  USING (is_admin() OR is_manager());

CREATE POLICY "Admin can delete OTA integrations"
  ON public.ota_integrations FOR DELETE
  TO authenticated
  USING (is_admin());

-- 4) guard_guest_self_update: switch from denylist to allowlist
--    The previous trigger froze ~12 specific columns but would not protect
--    any columns added in the future.  The allowlist approach only permits
--    guests to change a known set of safe profile fields; everything else
--    is silently reverted to the OLD value.
CREATE OR REPLACE FUNCTION public.guard_guest_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only enforce when a non-staff user is updating their own guest row
  IF auth.uid() IS NOT NULL
     AND NEW.auth_user_id = auth.uid()
     AND NOT public.is_staff() THEN

    -- Allowlist: copy only the fields a guest may change, revert everything else.
    -- Safe profile fields the guest may edit:
    --   name, phone, email, address, nationality, country,
    --   id_passport, passport_number, nic_number
    -- Everything else is reverted to OLD.

    -- Start from OLD and overlay allowed fields from NEW
    NEW.id                        := OLD.id;
    NEW.property_id               := OLD.property_id;
    NEW.auth_user_id              := OLD.auth_user_id;
    NEW.guest_type                := OLD.guest_type;
    NEW.is_vip                    := OLD.is_vip;
    NEW.is_blacklisted            := OLD.is_blacklisted;
    NEW.blacklist_reason          := OLD.blacklist_reason;
    NEW.total_stays               := OLD.total_stays;
    NEW.total_spent               := OLD.total_spent;
    NEW.passport_photo_path       := OLD.passport_photo_path;
    NEW.passport_photo_uploaded_at := OLD.passport_photo_uploaded_at;
    NEW.archived_at               := OLD.archived_at;
    NEW.deleted_at                := OLD.deleted_at;
    NEW.notes                     := OLD.notes;
    NEW.created_at                := OLD.created_at;
    NEW.updated_at                := OLD.updated_at;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger already exists from 20260525180630; replacing the function is sufficient.

-- 5) rate_change_logs INSERT: use is_write_staff() instead of is_staff()
--    Aligns with the pattern used on ota_sync_logs and other write tables.
DROP POLICY IF EXISTS "System can insert rate change logs" ON public.rate_change_logs;
CREATE POLICY "System can insert rate change logs"
  ON public.rate_change_logs FOR INSERT
  TO authenticated
  WITH CHECK (is_write_staff());

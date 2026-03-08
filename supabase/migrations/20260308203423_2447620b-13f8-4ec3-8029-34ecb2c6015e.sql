
-- 1. Create passport_photos table for audit trail and soft-delete
CREATE TABLE public.passport_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties(id),
  uploaded_by uuid NOT NULL,
  storage_path text NOT NULL,
  file_size integer,
  mime_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by uuid,
  scheduled_purge_at timestamptz
);

ALTER TABLE public.passport_photos ENABLE ROW LEVEL SECURITY;

-- Staff can view passport photos for accessible guests
CREATE POLICY "Staff can view passport photos"
  ON public.passport_photos FOR SELECT
  TO authenticated
  USING (public.is_staff() AND public.can_access_guest(property_id, guest_id));

-- Write staff can insert passport photos
CREATE POLICY "Write staff can insert passport photos"
  ON public.passport_photos FOR INSERT
  TO authenticated
  WITH CHECK (public.is_write_staff());

-- Write staff can update (for soft-delete)
CREATE POLICY "Write staff can update passport photos"
  ON public.passport_photos FOR UPDATE
  TO authenticated
  USING (public.is_write_staff());

-- Admin can delete passport photos permanently
CREATE POLICY "Admin can delete passport photos"
  ON public.passport_photos FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- 2. Create upload_rate_limits table
CREATE TABLE public.upload_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action_type text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 1
);

ALTER TABLE public.upload_rate_limits ENABLE ROW LEVEL SECURITY;

-- Only the system (service role) manages rate limits, but staff can view own
CREATE POLICY "Users can view own rate limits"
  ON public.upload_rate_limits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated can insert rate limits"
  ON public.upload_rate_limits FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated can update own rate limits"
  ON public.upload_rate_limits FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- 3. Create private passports bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('passports', 'passports', false);

-- 4. Storage RLS policies for passports bucket
CREATE POLICY "Write staff can upload passports"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'passports' AND public.is_write_staff());

CREATE POLICY "Staff can view passports"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'passports' AND public.is_staff());

CREATE POLICY "Admin can update passports"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'passports' AND public.is_admin());

CREATE POLICY "Admin can delete passports"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'passports' AND public.is_admin());

-- 5. Fix ALL RESTRICTIVE policies to PERMISSIVE across all tables
-- Drop and recreate all RESTRICTIVE policies as PERMISSIVE

-- notification_preferences
DROP POLICY IF EXISTS "Users can insert own notification preferences" ON public.notification_preferences;
DROP POLICY IF EXISTS "Users can update own notification preferences" ON public.notification_preferences;
DROP POLICY IF EXISTS "Users can view own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can insert own notification preferences" ON public.notification_preferences FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notification preferences" ON public.notification_preferences FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view own notification preferences" ON public.notification_preferences FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- sync_logs
DROP POLICY IF EXISTS "Staff can view sync logs" ON public.sync_logs;
DROP POLICY IF EXISTS "System can insert sync logs" ON public.sync_logs;
CREATE POLICY "Staff can view sync logs" ON public.sync_logs FOR SELECT TO authenticated USING (is_staff());
CREATE POLICY "System can insert sync logs" ON public.sync_logs FOR INSERT TO authenticated WITH CHECK (is_write_staff());

-- services
DROP POLICY IF EXISTS "Admin can delete services" ON public.services;
DROP POLICY IF EXISTS "Admin can insert services" ON public.services;
DROP POLICY IF EXISTS "Admin can update services" ON public.services;
DROP POLICY IF EXISTS "Staff can view all services" ON public.services;
CREATE POLICY "Admin can delete services" ON public.services FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Admin can insert services" ON public.services FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admin can update services" ON public.services FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Staff can view all services" ON public.services FOR SELECT TO authenticated USING (is_staff());

-- invoices
DROP POLICY IF EXISTS "Admin can delete invoices" ON public.invoices;
DROP POLICY IF EXISTS "Staff can insert invoices" ON public.invoices;
DROP POLICY IF EXISTS "Staff can update invoices" ON public.invoices;
DROP POLICY IF EXISTS "Staff can view all invoices" ON public.invoices;
CREATE POLICY "Admin can delete invoices" ON public.invoices FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Staff can insert invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK (is_write_staff());
CREATE POLICY "Staff can update invoices" ON public.invoices FOR UPDATE TO authenticated USING (is_write_staff());
CREATE POLICY "Staff can view all invoices" ON public.invoices FOR SELECT TO authenticated USING (is_staff());

-- channel_room_mappings
DROP POLICY IF EXISTS "Admin can delete room mappings" ON public.channel_room_mappings;
DROP POLICY IF EXISTS "Admin/Manager can insert room mappings" ON public.channel_room_mappings;
DROP POLICY IF EXISTS "Admin/Manager can update room mappings" ON public.channel_room_mappings;
DROP POLICY IF EXISTS "Staff can view room mappings" ON public.channel_room_mappings;
CREATE POLICY "Admin can delete room mappings" ON public.channel_room_mappings FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Admin/Manager can insert room mappings" ON public.channel_room_mappings FOR INSERT TO authenticated WITH CHECK (is_admin() OR is_manager());
CREATE POLICY "Admin/Manager can update room mappings" ON public.channel_room_mappings FOR UPDATE TO authenticated USING (is_admin() OR is_manager());
CREATE POLICY "Staff can view room mappings" ON public.channel_room_mappings FOR SELECT TO authenticated USING (is_staff());

-- rate_plans
DROP POLICY IF EXISTS "Admin can delete rate plans" ON public.rate_plans;
DROP POLICY IF EXISTS "Admin can insert rate plans" ON public.rate_plans;
DROP POLICY IF EXISTS "Admin can update rate plans" ON public.rate_plans;
DROP POLICY IF EXISTS "Staff can view rate plans" ON public.rate_plans;
CREATE POLICY "Admin can delete rate plans" ON public.rate_plans FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Admin can insert rate plans" ON public.rate_plans FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admin can update rate plans" ON public.rate_plans FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Staff can view rate plans" ON public.rate_plans FOR SELECT TO authenticated USING (is_staff());

-- bookings
DROP POLICY IF EXISTS "Only Admin can delete bookings" ON public.bookings;
DROP POLICY IF EXISTS "Staff can insert bookings" ON public.bookings;
DROP POLICY IF EXISTS "Staff can update bookings" ON public.bookings;
DROP POLICY IF EXISTS "Staff can view all bookings" ON public.bookings;
CREATE POLICY "Only Admin can delete bookings" ON public.bookings FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Staff can insert bookings" ON public.bookings FOR INSERT TO authenticated WITH CHECK (is_write_staff());
CREATE POLICY "Staff can update bookings" ON public.bookings FOR UPDATE TO authenticated USING (is_write_staff());
CREATE POLICY "Staff can view all bookings" ON public.bookings FOR SELECT TO authenticated USING (is_staff());

-- seasonal_rules
DROP POLICY IF EXISTS "Admin can delete seasonal rules" ON public.seasonal_rules;
DROP POLICY IF EXISTS "Admin can insert seasonal rules" ON public.seasonal_rules;
DROP POLICY IF EXISTS "Admin can update seasonal rules" ON public.seasonal_rules;
DROP POLICY IF EXISTS "Staff can view seasonal rules" ON public.seasonal_rules;
CREATE POLICY "Admin can delete seasonal rules" ON public.seasonal_rules FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Admin can insert seasonal rules" ON public.seasonal_rules FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admin can update seasonal rules" ON public.seasonal_rules FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Staff can view seasonal rules" ON public.seasonal_rules FOR SELECT TO authenticated USING (is_staff());

-- rate_plan_room_types
DROP POLICY IF EXISTS "Admin can delete rate plan room types" ON public.rate_plan_room_types;
DROP POLICY IF EXISTS "Admin can insert rate plan room types" ON public.rate_plan_room_types;
DROP POLICY IF EXISTS "Admin can update rate plan room types" ON public.rate_plan_room_types;
DROP POLICY IF EXISTS "Staff can view rate plan room types" ON public.rate_plan_room_types;
CREATE POLICY "Admin can delete rate plan room types" ON public.rate_plan_room_types FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Admin can insert rate plan room types" ON public.rate_plan_room_types FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admin can update rate plan room types" ON public.rate_plan_room_types FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Staff can view rate plan room types" ON public.rate_plan_room_types FOR SELECT TO authenticated USING (is_staff());

-- guest_services
DROP POLICY IF EXISTS "Admin/Manager can delete guest services" ON public.guest_services;
DROP POLICY IF EXISTS "Staff can insert guest services" ON public.guest_services;
DROP POLICY IF EXISTS "Staff can update guest services" ON public.guest_services;
DROP POLICY IF EXISTS "Staff can view all guest services" ON public.guest_services;
CREATE POLICY "Admin/Manager can delete guest services" ON public.guest_services FOR DELETE TO authenticated USING (is_admin() OR is_manager());
CREATE POLICY "Staff can insert guest services" ON public.guest_services FOR INSERT TO authenticated WITH CHECK (is_write_staff());
CREATE POLICY "Staff can update guest services" ON public.guest_services FOR UPDATE TO authenticated USING (is_write_staff());
CREATE POLICY "Staff can view all guest services" ON public.guest_services FOR SELECT TO authenticated USING (is_staff());

-- discount_codes
DROP POLICY IF EXISTS "Admin can delete discount codes" ON public.discount_codes;
DROP POLICY IF EXISTS "Admin can insert discount codes" ON public.discount_codes;
DROP POLICY IF EXISTS "Admin can update discount codes" ON public.discount_codes;
DROP POLICY IF EXISTS "Staff can view discount codes" ON public.discount_codes;
CREATE POLICY "Admin can delete discount codes" ON public.discount_codes FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Admin can insert discount codes" ON public.discount_codes FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admin can update discount codes" ON public.discount_codes FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Staff can view discount codes" ON public.discount_codes FOR SELECT TO authenticated USING (is_staff());

-- rate_overrides
DROP POLICY IF EXISTS "Admin can delete rate overrides" ON public.rate_overrides;
DROP POLICY IF EXISTS "Admin can insert rate overrides" ON public.rate_overrides;
DROP POLICY IF EXISTS "Admin can update rate overrides" ON public.rate_overrides;
DROP POLICY IF EXISTS "Staff can view rate overrides" ON public.rate_overrides;
CREATE POLICY "Admin can delete rate overrides" ON public.rate_overrides FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Admin can insert rate overrides" ON public.rate_overrides FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admin can update rate overrides" ON public.rate_overrides FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Staff can view rate overrides" ON public.rate_overrides FOR SELECT TO authenticated USING (is_staff());

-- audit_logs
DROP POLICY IF EXISTS "Admin can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Staff can insert audit logs" ON public.audit_logs;
CREATE POLICY "Admin can view audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Staff can insert audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (is_write_staff() AND auth.uid() = user_id);

-- user_property_access
DROP POLICY IF EXISTS "Admin can manage property access" ON public.user_property_access;
DROP POLICY IF EXISTS "Users can view their own property access" ON public.user_property_access;
CREATE POLICY "Admin can manage property access" ON public.user_property_access FOR ALL TO authenticated USING (is_admin());
CREATE POLICY "Users can view their own property access" ON public.user_property_access FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- user_settings
DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
CREATE POLICY "Users can insert own settings" ON public.user_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON public.user_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view own settings" ON public.user_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- payments
DROP POLICY IF EXISTS "Admin can delete payments" ON public.payments;
DROP POLICY IF EXISTS "Staff can insert payments" ON public.payments;
DROP POLICY IF EXISTS "Staff can update payments" ON public.payments;
DROP POLICY IF EXISTS "Staff can view all payments" ON public.payments;
CREATE POLICY "Admin can delete payments" ON public.payments FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Staff can insert payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (is_write_staff());
CREATE POLICY "Staff can update payments" ON public.payments FOR UPDATE TO authenticated USING (is_write_staff());
CREATE POLICY "Staff can view all payments" ON public.payments FOR SELECT TO authenticated USING (is_staff());

-- user_roles
DROP POLICY IF EXISTS "Admin can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins and managers can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
CREATE POLICY "Admin can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Admin can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admin can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Admins and managers can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (is_admin() OR is_manager());
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- email_ingest_logs
DROP POLICY IF EXISTS "Staff can insert email logs" ON public.email_ingest_logs;
DROP POLICY IF EXISTS "Staff can update email logs" ON public.email_ingest_logs;
DROP POLICY IF EXISTS "Staff can view email logs for accessible properties" ON public.email_ingest_logs;
CREATE POLICY "Staff can insert email logs" ON public.email_ingest_logs FOR INSERT TO authenticated WITH CHECK (is_write_staff());
CREATE POLICY "Staff can update email logs" ON public.email_ingest_logs FOR UPDATE TO authenticated USING (is_write_staff());
CREATE POLICY "Staff can view email logs for accessible properties" ON public.email_ingest_logs FOR SELECT TO authenticated USING (is_staff());

-- properties
DROP POLICY IF EXISTS "Admin can delete properties" ON public.properties;
DROP POLICY IF EXISTS "Admin can insert properties" ON public.properties;
DROP POLICY IF EXISTS "Admin can update properties" ON public.properties;
DROP POLICY IF EXISTS "Staff can view active properties they have access to" ON public.properties;
CREATE POLICY "Admin can delete properties" ON public.properties FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Admin can insert properties" ON public.properties FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admin can update properties" ON public.properties FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Staff can view active properties they have access to" ON public.properties FOR SELECT TO authenticated USING (is_staff() AND (is_admin() OR is_manager() OR EXISTS (SELECT 1 FROM user_property_access WHERE user_property_access.user_id = auth.uid() AND user_property_access.property_id = properties.id) OR NOT EXISTS (SELECT 1 FROM user_property_access WHERE user_property_access.user_id = auth.uid())));

-- ledger_entries
DROP POLICY IF EXISTS "Admin can delete ledger entries" ON public.ledger_entries;
DROP POLICY IF EXISTS "Staff can view ledger entries" ON public.ledger_entries;
DROP POLICY IF EXISTS "Write staff can insert ledger entries" ON public.ledger_entries;
DROP POLICY IF EXISTS "Write staff can update ledger entries" ON public.ledger_entries;
CREATE POLICY "Admin can delete ledger entries" ON public.ledger_entries FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Staff can view ledger entries" ON public.ledger_entries FOR SELECT TO authenticated USING (is_staff());
CREATE POLICY "Write staff can insert ledger entries" ON public.ledger_entries FOR INSERT TO authenticated WITH CHECK (is_write_staff());
CREATE POLICY "Write staff can update ledger entries" ON public.ledger_entries FOR UPDATE TO authenticated USING (is_write_staff());

-- notifications
DROP POLICY IF EXISTS "Admin can delete notifications" ON public.notifications;
DROP POLICY IF EXISTS "Staff can mark notifications read" ON public.notifications;
DROP POLICY IF EXISTS "Staff can view role-based notifications" ON public.notifications;
CREATE POLICY "Admin can delete notifications" ON public.notifications FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Staff can mark notifications read" ON public.notifications FOR UPDATE TO authenticated USING (user_has_notification_access(target_roles, property_id)) WITH CHECK (user_has_notification_access(target_roles, property_id));
CREATE POLICY "Staff can view role-based notifications" ON public.notifications FOR SELECT TO authenticated USING (user_has_notification_access(target_roles, property_id));

-- rooms
DROP POLICY IF EXISTS "Admin can delete rooms" ON public.rooms;
DROP POLICY IF EXISTS "Admin can insert rooms" ON public.rooms;
DROP POLICY IF EXISTS "Staff can view all rooms" ON public.rooms;
DROP POLICY IF EXISTS "Write staff can update rooms" ON public.rooms;
CREATE POLICY "Admin can delete rooms" ON public.rooms FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Admin can insert rooms" ON public.rooms FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Staff can view all rooms" ON public.rooms FOR SELECT TO authenticated USING (is_staff());
CREATE POLICY "Write staff can update rooms" ON public.rooms FOR UPDATE TO authenticated USING (is_write_staff());

-- guest_feedback
DROP POLICY IF EXISTS "Admin can delete feedback" ON public.guest_feedback;
DROP POLICY IF EXISTS "Staff can view all feedback" ON public.guest_feedback;
DROP POLICY IF EXISTS "Write staff can insert feedback" ON public.guest_feedback;
DROP POLICY IF EXISTS "Write staff can update feedback" ON public.guest_feedback;
CREATE POLICY "Admin can delete feedback" ON public.guest_feedback FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Staff can view all feedback" ON public.guest_feedback FOR SELECT TO authenticated USING (is_staff());
CREATE POLICY "Write staff can insert feedback" ON public.guest_feedback FOR INSERT TO authenticated WITH CHECK (is_write_staff());
CREATE POLICY "Write staff can update feedback" ON public.guest_feedback FOR UPDATE TO authenticated USING (is_write_staff());

-- ledger_accounts
DROP POLICY IF EXISTS "Admin can delete ledger accounts" ON public.ledger_accounts;
DROP POLICY IF EXISTS "Staff can view ledger accounts" ON public.ledger_accounts;
DROP POLICY IF EXISTS "Write staff can insert ledger accounts" ON public.ledger_accounts;
DROP POLICY IF EXISTS "Write staff can update ledger accounts" ON public.ledger_accounts;
CREATE POLICY "Admin can delete ledger accounts" ON public.ledger_accounts FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Staff can view ledger accounts" ON public.ledger_accounts FOR SELECT TO authenticated USING (is_staff());
CREATE POLICY "Write staff can insert ledger accounts" ON public.ledger_accounts FOR INSERT TO authenticated WITH CHECK (is_write_staff());
CREATE POLICY "Write staff can update ledger accounts" ON public.ledger_accounts FOR UPDATE TO authenticated USING (is_write_staff());

-- day_of_week_rules
DROP POLICY IF EXISTS "Admin can delete day of week rules" ON public.day_of_week_rules;
DROP POLICY IF EXISTS "Admin can insert day of week rules" ON public.day_of_week_rules;
DROP POLICY IF EXISTS "Admin can update day of week rules" ON public.day_of_week_rules;
DROP POLICY IF EXISTS "Staff can view day of week rules" ON public.day_of_week_rules;
CREATE POLICY "Admin can delete day of week rules" ON public.day_of_week_rules FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Admin can insert day of week rules" ON public.day_of_week_rules FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admin can update day of week rules" ON public.day_of_week_rules FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Staff can view day of week rules" ON public.day_of_week_rules FOR SELECT TO authenticated USING (is_staff());

-- discount_code_usages
DROP POLICY IF EXISTS "Staff can view discount usages" ON public.discount_code_usages;
DROP POLICY IF EXISTS "Write staff can insert discount usages" ON public.discount_code_usages;
CREATE POLICY "Staff can view discount usages" ON public.discount_code_usages FOR SELECT TO authenticated USING (is_staff());
CREATE POLICY "Write staff can insert discount usages" ON public.discount_code_usages FOR INSERT TO authenticated WITH CHECK (is_write_staff());

-- ledger_lines
DROP POLICY IF EXISTS "Admin can delete ledger lines" ON public.ledger_lines;
DROP POLICY IF EXISTS "Staff can view ledger lines" ON public.ledger_lines;
DROP POLICY IF EXISTS "Write staff can insert ledger lines" ON public.ledger_lines;
DROP POLICY IF EXISTS "Write staff can update ledger lines" ON public.ledger_lines;
CREATE POLICY "Admin can delete ledger lines" ON public.ledger_lines FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Staff can view ledger lines" ON public.ledger_lines FOR SELECT TO authenticated USING (is_staff());
CREATE POLICY "Write staff can insert ledger lines" ON public.ledger_lines FOR INSERT TO authenticated WITH CHECK (is_write_staff());
CREATE POLICY "Write staff can update ledger lines" ON public.ledger_lines FOR UPDATE TO authenticated USING (is_write_staff());

-- profiles
DROP POLICY IF EXISTS "Staff can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Staff can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (is_staff());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);

-- room_availability
DROP POLICY IF EXISTS "Admin/Manager can delete room availability" ON public.room_availability;
DROP POLICY IF EXISTS "Staff can insert room availability" ON public.room_availability;
DROP POLICY IF EXISTS "Staff can update room availability" ON public.room_availability;
DROP POLICY IF EXISTS "Staff can view room availability" ON public.room_availability;
CREATE POLICY "Admin/Manager can delete room availability" ON public.room_availability FOR DELETE TO authenticated USING (is_admin() OR is_manager());
CREATE POLICY "Staff can insert room availability" ON public.room_availability FOR INSERT TO authenticated WITH CHECK (is_write_staff());
CREATE POLICY "Staff can update room availability" ON public.room_availability FOR UPDATE TO authenticated USING (is_write_staff());
CREATE POLICY "Staff can view room availability" ON public.room_availability FOR SELECT TO authenticated USING (is_staff());

-- booking_transactions
DROP POLICY IF EXISTS "Admin can delete booking transactions" ON public.booking_transactions;
DROP POLICY IF EXISTS "Staff can view booking transactions" ON public.booking_transactions;
DROP POLICY IF EXISTS "Write staff can insert booking transactions" ON public.booking_transactions;
DROP POLICY IF EXISTS "Write staff can update booking transactions" ON public.booking_transactions;
CREATE POLICY "Admin can delete booking transactions" ON public.booking_transactions FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Staff can view booking transactions" ON public.booking_transactions FOR SELECT TO authenticated USING (is_staff());
CREATE POLICY "Write staff can insert booking transactions" ON public.booking_transactions FOR INSERT TO authenticated WITH CHECK (is_write_staff());
CREATE POLICY "Write staff can update booking transactions" ON public.booking_transactions FOR UPDATE TO authenticated USING (is_write_staff());

-- guests
DROP POLICY IF EXISTS "Admin can delete guests" ON public.guests;
DROP POLICY IF EXISTS "Secure guest access by role and property" ON public.guests;
DROP POLICY IF EXISTS "Staff can insert guests" ON public.guests;
DROP POLICY IF EXISTS "Staff can update guests" ON public.guests;
CREATE POLICY "Admin can delete guests" ON public.guests FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Secure guest access by role and property" ON public.guests FOR SELECT TO authenticated USING (can_access_guest(property_id, id));
CREATE POLICY "Staff can insert guests" ON public.guests FOR INSERT TO authenticated WITH CHECK (is_write_staff());
CREATE POLICY "Staff can update guests" ON public.guests FOR UPDATE TO authenticated USING (is_write_staff());

-- property_inventory_settings
DROP POLICY IF EXISTS "Admin can delete inventory settings" ON public.property_inventory_settings;
DROP POLICY IF EXISTS "Only Admin can insert inventory settings" ON public.property_inventory_settings;
DROP POLICY IF EXISTS "Only Admin can update inventory settings" ON public.property_inventory_settings;
DROP POLICY IF EXISTS "Staff can view inventory settings" ON public.property_inventory_settings;
CREATE POLICY "Admin can delete inventory settings" ON public.property_inventory_settings FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Only Admin can insert inventory settings" ON public.property_inventory_settings FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Only Admin can update inventory settings" ON public.property_inventory_settings FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Staff can view inventory settings" ON public.property_inventory_settings FOR SELECT TO authenticated USING (is_staff());

-- guest_view_logs
DROP POLICY IF EXISTS "Admin/Manager can view guest view logs" ON public.guest_view_logs;
DROP POLICY IF EXISTS "Staff can insert guest view logs" ON public.guest_view_logs;
CREATE POLICY "Admin/Manager can view guest view logs" ON public.guest_view_logs FOR SELECT TO authenticated USING (is_admin() OR is_manager());
CREATE POLICY "Staff can insert guest view logs" ON public.guest_view_logs FOR INSERT TO authenticated WITH CHECK (is_write_staff() AND auth.uid() = user_id);

-- channel_connections
DROP POLICY IF EXISTS "Admin can delete channel connections" ON public.channel_connections;
DROP POLICY IF EXISTS "Admin can insert channel connections" ON public.channel_connections;
DROP POLICY IF EXISTS "Admin can update channel connections" ON public.channel_connections;
DROP POLICY IF EXISTS "Staff can view channel connections" ON public.channel_connections;
CREATE POLICY "Admin can delete channel connections" ON public.channel_connections FOR DELETE TO authenticated USING (is_admin());
CREATE POLICY "Admin can insert channel connections" ON public.channel_connections FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admin can update channel connections" ON public.channel_connections FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Staff can view channel connections" ON public.channel_connections FOR SELECT TO authenticated USING (is_staff());

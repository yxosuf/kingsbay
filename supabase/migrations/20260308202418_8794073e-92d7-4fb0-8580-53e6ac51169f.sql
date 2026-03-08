
-- =====================================================
-- Fix: Convert ALL 122 RESTRICTIVE RLS policies to PERMISSIVE
-- RESTRICTIVE-only policies result in no access (PostgreSQL requires
-- at least one PERMISSIVE policy for rows to be accessible).
-- =====================================================

-- ========== notification_preferences ==========
DROP POLICY IF EXISTS "Users can insert own notification preferences" ON public.notification_preferences;
DROP POLICY IF EXISTS "Users can update own notification preferences" ON public.notification_preferences;
DROP POLICY IF EXISTS "Users can view own notification preferences" ON public.notification_preferences;

CREATE POLICY "Users can insert own notification preferences" ON public.notification_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notification preferences" ON public.notification_preferences FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can view own notification preferences" ON public.notification_preferences FOR SELECT USING (auth.uid() = user_id);

-- ========== sync_logs ==========
DROP POLICY IF EXISTS "Staff can view sync logs" ON public.sync_logs;
DROP POLICY IF EXISTS "System can insert sync logs" ON public.sync_logs;

CREATE POLICY "Staff can view sync logs" ON public.sync_logs FOR SELECT USING (is_staff());
CREATE POLICY "System can insert sync logs" ON public.sync_logs FOR INSERT WITH CHECK (is_write_staff());

-- ========== services ==========
DROP POLICY IF EXISTS "Admin can delete services" ON public.services;
DROP POLICY IF EXISTS "Admin can insert services" ON public.services;
DROP POLICY IF EXISTS "Admin can update services" ON public.services;
DROP POLICY IF EXISTS "Staff can view all services" ON public.services;

CREATE POLICY "Admin can delete services" ON public.services FOR DELETE USING (is_admin());
CREATE POLICY "Admin can insert services" ON public.services FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admin can update services" ON public.services FOR UPDATE USING (is_admin());
CREATE POLICY "Staff can view all services" ON public.services FOR SELECT USING (is_staff());

-- ========== invoices ==========
DROP POLICY IF EXISTS "Admin can delete invoices" ON public.invoices;
DROP POLICY IF EXISTS "Staff can insert invoices" ON public.invoices;
DROP POLICY IF EXISTS "Staff can update invoices" ON public.invoices;
DROP POLICY IF EXISTS "Staff can view all invoices" ON public.invoices;

CREATE POLICY "Admin can delete invoices" ON public.invoices FOR DELETE USING (is_admin());
CREATE POLICY "Staff can insert invoices" ON public.invoices FOR INSERT WITH CHECK (is_write_staff());
CREATE POLICY "Staff can update invoices" ON public.invoices FOR UPDATE USING (is_write_staff());
CREATE POLICY "Staff can view all invoices" ON public.invoices FOR SELECT USING (is_staff());

-- ========== channel_room_mappings ==========
DROP POLICY IF EXISTS "Admin can delete room mappings" ON public.channel_room_mappings;
DROP POLICY IF EXISTS "Admin/Manager can insert room mappings" ON public.channel_room_mappings;
DROP POLICY IF EXISTS "Admin/Manager can update room mappings" ON public.channel_room_mappings;
DROP POLICY IF EXISTS "Staff can view room mappings" ON public.channel_room_mappings;

CREATE POLICY "Admin can delete room mappings" ON public.channel_room_mappings FOR DELETE USING (is_admin());
CREATE POLICY "Admin/Manager can insert room mappings" ON public.channel_room_mappings FOR INSERT WITH CHECK (is_admin() OR is_manager());
CREATE POLICY "Admin/Manager can update room mappings" ON public.channel_room_mappings FOR UPDATE USING (is_admin() OR is_manager());
CREATE POLICY "Staff can view room mappings" ON public.channel_room_mappings FOR SELECT USING (is_staff());

-- ========== rate_plans ==========
DROP POLICY IF EXISTS "Admin can delete rate plans" ON public.rate_plans;
DROP POLICY IF EXISTS "Admin can insert rate plans" ON public.rate_plans;
DROP POLICY IF EXISTS "Admin can update rate plans" ON public.rate_plans;
DROP POLICY IF EXISTS "Staff can view rate plans" ON public.rate_plans;

CREATE POLICY "Admin can delete rate plans" ON public.rate_plans FOR DELETE USING (is_admin());
CREATE POLICY "Admin can insert rate plans" ON public.rate_plans FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admin can update rate plans" ON public.rate_plans FOR UPDATE USING (is_admin());
CREATE POLICY "Staff can view rate plans" ON public.rate_plans FOR SELECT USING (is_staff());

-- ========== bookings ==========
DROP POLICY IF EXISTS "Only Admin can delete bookings" ON public.bookings;
DROP POLICY IF EXISTS "Staff can insert bookings" ON public.bookings;
DROP POLICY IF EXISTS "Staff can update bookings" ON public.bookings;
DROP POLICY IF EXISTS "Staff can view all bookings" ON public.bookings;

CREATE POLICY "Only Admin can delete bookings" ON public.bookings FOR DELETE USING (is_admin());
CREATE POLICY "Staff can insert bookings" ON public.bookings FOR INSERT WITH CHECK (is_write_staff());
CREATE POLICY "Staff can update bookings" ON public.bookings FOR UPDATE USING (is_write_staff());
CREATE POLICY "Staff can view all bookings" ON public.bookings FOR SELECT USING (is_staff());

-- ========== seasonal_rules ==========
DROP POLICY IF EXISTS "Admin can delete seasonal rules" ON public.seasonal_rules;
DROP POLICY IF EXISTS "Admin can insert seasonal rules" ON public.seasonal_rules;
DROP POLICY IF EXISTS "Admin can update seasonal rules" ON public.seasonal_rules;
DROP POLICY IF EXISTS "Staff can view seasonal rules" ON public.seasonal_rules;

CREATE POLICY "Admin can delete seasonal rules" ON public.seasonal_rules FOR DELETE USING (is_admin());
CREATE POLICY "Admin can insert seasonal rules" ON public.seasonal_rules FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admin can update seasonal rules" ON public.seasonal_rules FOR UPDATE USING (is_admin());
CREATE POLICY "Staff can view seasonal rules" ON public.seasonal_rules FOR SELECT USING (is_staff());

-- ========== rate_plan_room_types ==========
DROP POLICY IF EXISTS "Admin can delete rate plan room types" ON public.rate_plan_room_types;
DROP POLICY IF EXISTS "Admin can insert rate plan room types" ON public.rate_plan_room_types;
DROP POLICY IF EXISTS "Admin can update rate plan room types" ON public.rate_plan_room_types;
DROP POLICY IF EXISTS "Staff can view rate plan room types" ON public.rate_plan_room_types;

CREATE POLICY "Admin can delete rate plan room types" ON public.rate_plan_room_types FOR DELETE USING (is_admin());
CREATE POLICY "Admin can insert rate plan room types" ON public.rate_plan_room_types FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admin can update rate plan room types" ON public.rate_plan_room_types FOR UPDATE USING (is_admin());
CREATE POLICY "Staff can view rate plan room types" ON public.rate_plan_room_types FOR SELECT USING (is_staff());

-- ========== guest_services ==========
DROP POLICY IF EXISTS "Admin/Manager can delete guest services" ON public.guest_services;
DROP POLICY IF EXISTS "Staff can insert guest services" ON public.guest_services;
DROP POLICY IF EXISTS "Staff can update guest services" ON public.guest_services;
DROP POLICY IF EXISTS "Staff can view all guest services" ON public.guest_services;

CREATE POLICY "Admin/Manager can delete guest services" ON public.guest_services FOR DELETE USING (is_admin() OR is_manager());
CREATE POLICY "Staff can insert guest services" ON public.guest_services FOR INSERT WITH CHECK (is_write_staff());
CREATE POLICY "Staff can update guest services" ON public.guest_services FOR UPDATE USING (is_write_staff());
CREATE POLICY "Staff can view all guest services" ON public.guest_services FOR SELECT USING (is_staff());

-- ========== discount_codes ==========
DROP POLICY IF EXISTS "Admin can delete discount codes" ON public.discount_codes;
DROP POLICY IF EXISTS "Admin can insert discount codes" ON public.discount_codes;
DROP POLICY IF EXISTS "Admin can update discount codes" ON public.discount_codes;
DROP POLICY IF EXISTS "Staff can view discount codes" ON public.discount_codes;

CREATE POLICY "Admin can delete discount codes" ON public.discount_codes FOR DELETE USING (is_admin());
CREATE POLICY "Admin can insert discount codes" ON public.discount_codes FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admin can update discount codes" ON public.discount_codes FOR UPDATE USING (is_admin());
CREATE POLICY "Staff can view discount codes" ON public.discount_codes FOR SELECT USING (is_staff());

-- ========== rate_overrides ==========
DROP POLICY IF EXISTS "Admin can delete rate overrides" ON public.rate_overrides;
DROP POLICY IF EXISTS "Admin can insert rate overrides" ON public.rate_overrides;
DROP POLICY IF EXISTS "Admin can update rate overrides" ON public.rate_overrides;
DROP POLICY IF EXISTS "Staff can view rate overrides" ON public.rate_overrides;

CREATE POLICY "Admin can delete rate overrides" ON public.rate_overrides FOR DELETE USING (is_admin());
CREATE POLICY "Admin can insert rate overrides" ON public.rate_overrides FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admin can update rate overrides" ON public.rate_overrides FOR UPDATE USING (is_admin());
CREATE POLICY "Staff can view rate overrides" ON public.rate_overrides FOR SELECT USING (is_staff());

-- ========== audit_logs ==========
DROP POLICY IF EXISTS "Admin can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Staff can insert audit logs" ON public.audit_logs;

CREATE POLICY "Admin can view audit logs" ON public.audit_logs FOR SELECT USING (is_admin());
CREATE POLICY "Staff can insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK (is_write_staff() AND (auth.uid() = user_id));

-- ========== user_property_access ==========
DROP POLICY IF EXISTS "Admin can manage property access" ON public.user_property_access;
DROP POLICY IF EXISTS "Users can view their own property access" ON public.user_property_access;

CREATE POLICY "Admin can manage property access" ON public.user_property_access FOR ALL USING (is_admin());
CREATE POLICY "Users can view their own property access" ON public.user_property_access FOR SELECT USING (auth.uid() = user_id);

-- ========== user_settings ==========
DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;

CREATE POLICY "Users can insert own settings" ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can view own settings" ON public.user_settings FOR SELECT USING (auth.uid() = user_id);

-- ========== payments ==========
DROP POLICY IF EXISTS "Admin can delete payments" ON public.payments;
DROP POLICY IF EXISTS "Staff can insert payments" ON public.payments;
DROP POLICY IF EXISTS "Staff can update payments" ON public.payments;
DROP POLICY IF EXISTS "Staff can view all payments" ON public.payments;

CREATE POLICY "Admin can delete payments" ON public.payments FOR DELETE USING (is_admin());
CREATE POLICY "Staff can insert payments" ON public.payments FOR INSERT WITH CHECK (is_write_staff());
CREATE POLICY "Staff can update payments" ON public.payments FOR UPDATE USING (is_write_staff());
CREATE POLICY "Staff can view all payments" ON public.payments FOR SELECT USING (is_staff());

-- ========== user_roles ==========
DROP POLICY IF EXISTS "Admin can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admin can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins and managers can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;

CREATE POLICY "Admin can delete roles" ON public.user_roles FOR DELETE USING (is_admin());
CREATE POLICY "Admin can insert roles" ON public.user_roles FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admin can update roles" ON public.user_roles FOR UPDATE USING (is_admin());
CREATE POLICY "Admins and managers can view all roles" ON public.user_roles FOR SELECT USING (is_admin() OR is_manager());
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- ========== email_ingest_logs ==========
DROP POLICY IF EXISTS "Staff can insert email logs" ON public.email_ingest_logs;
DROP POLICY IF EXISTS "Staff can update email logs" ON public.email_ingest_logs;
DROP POLICY IF EXISTS "Staff can view email logs for accessible properties" ON public.email_ingest_logs;

CREATE POLICY "Staff can insert email logs" ON public.email_ingest_logs FOR INSERT WITH CHECK (is_write_staff());
CREATE POLICY "Staff can update email logs" ON public.email_ingest_logs FOR UPDATE USING (is_write_staff());
CREATE POLICY "Staff can view email logs for accessible properties" ON public.email_ingest_logs FOR SELECT USING (is_staff());

-- ========== properties ==========
DROP POLICY IF EXISTS "Admin can delete properties" ON public.properties;
DROP POLICY IF EXISTS "Admin can insert properties" ON public.properties;
DROP POLICY IF EXISTS "Admin can update properties" ON public.properties;
DROP POLICY IF EXISTS "Staff can view active properties they have access to" ON public.properties;

CREATE POLICY "Admin can delete properties" ON public.properties FOR DELETE USING (is_admin());
CREATE POLICY "Admin can insert properties" ON public.properties FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admin can update properties" ON public.properties FOR UPDATE USING (is_admin());
CREATE POLICY "Staff can view active properties they have access to" ON public.properties FOR SELECT USING (
  is_staff() AND (
    is_admin() OR is_manager()
    OR EXISTS (SELECT 1 FROM user_property_access WHERE user_property_access.user_id = auth.uid() AND user_property_access.property_id = properties.id)
    OR NOT EXISTS (SELECT 1 FROM user_property_access WHERE user_property_access.user_id = auth.uid())
  )
);

-- ========== ledger_entries ==========
DROP POLICY IF EXISTS "Admin can delete ledger entries" ON public.ledger_entries;
DROP POLICY IF EXISTS "Staff can view ledger entries" ON public.ledger_entries;
DROP POLICY IF EXISTS "Write staff can insert ledger entries" ON public.ledger_entries;
DROP POLICY IF EXISTS "Write staff can update ledger entries" ON public.ledger_entries;

CREATE POLICY "Admin can delete ledger entries" ON public.ledger_entries FOR DELETE USING (is_admin());
CREATE POLICY "Staff can view ledger entries" ON public.ledger_entries FOR SELECT USING (is_staff());
CREATE POLICY "Write staff can insert ledger entries" ON public.ledger_entries FOR INSERT WITH CHECK (is_write_staff());
CREATE POLICY "Write staff can update ledger entries" ON public.ledger_entries FOR UPDATE USING (is_write_staff());

-- ========== notifications ==========
DROP POLICY IF EXISTS "Admin can delete notifications" ON public.notifications;
DROP POLICY IF EXISTS "Staff can mark notifications read" ON public.notifications;
DROP POLICY IF EXISTS "Staff can view role-based notifications" ON public.notifications;

CREATE POLICY "Admin can delete notifications" ON public.notifications FOR DELETE USING (is_admin());
CREATE POLICY "Staff can mark notifications read" ON public.notifications FOR UPDATE USING (user_has_notification_access(target_roles, property_id)) WITH CHECK (user_has_notification_access(target_roles, property_id));
CREATE POLICY "Staff can view role-based notifications" ON public.notifications FOR SELECT USING (user_has_notification_access(target_roles, property_id));

-- ========== rooms ==========
DROP POLICY IF EXISTS "Admin can delete rooms" ON public.rooms;
DROP POLICY IF EXISTS "Admin can insert rooms" ON public.rooms;
DROP POLICY IF EXISTS "Staff can view all rooms" ON public.rooms;
DROP POLICY IF EXISTS "Write staff can update rooms" ON public.rooms;

CREATE POLICY "Admin can delete rooms" ON public.rooms FOR DELETE USING (is_admin());
CREATE POLICY "Admin can insert rooms" ON public.rooms FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Staff can view all rooms" ON public.rooms FOR SELECT USING (is_staff());
CREATE POLICY "Write staff can update rooms" ON public.rooms FOR UPDATE USING (is_write_staff());

-- ========== guest_feedback ==========
DROP POLICY IF EXISTS "Admin can delete feedback" ON public.guest_feedback;
DROP POLICY IF EXISTS "Staff can view all feedback" ON public.guest_feedback;
DROP POLICY IF EXISTS "Write staff can insert feedback" ON public.guest_feedback;
DROP POLICY IF EXISTS "Write staff can update feedback" ON public.guest_feedback;

CREATE POLICY "Admin can delete feedback" ON public.guest_feedback FOR DELETE USING (is_admin());
CREATE POLICY "Staff can view all feedback" ON public.guest_feedback FOR SELECT USING (is_staff());
CREATE POLICY "Write staff can insert feedback" ON public.guest_feedback FOR INSERT WITH CHECK (is_write_staff());
CREATE POLICY "Write staff can update feedback" ON public.guest_feedback FOR UPDATE USING (is_write_staff());

-- ========== ledger_accounts ==========
DROP POLICY IF EXISTS "Admin can delete ledger accounts" ON public.ledger_accounts;
DROP POLICY IF EXISTS "Staff can view ledger accounts" ON public.ledger_accounts;
DROP POLICY IF EXISTS "Write staff can insert ledger accounts" ON public.ledger_accounts;
DROP POLICY IF EXISTS "Write staff can update ledger accounts" ON public.ledger_accounts;

CREATE POLICY "Admin can delete ledger accounts" ON public.ledger_accounts FOR DELETE USING (is_admin());
CREATE POLICY "Staff can view ledger accounts" ON public.ledger_accounts FOR SELECT USING (is_staff());
CREATE POLICY "Write staff can insert ledger accounts" ON public.ledger_accounts FOR INSERT WITH CHECK (is_write_staff());
CREATE POLICY "Write staff can update ledger accounts" ON public.ledger_accounts FOR UPDATE USING (is_write_staff());

-- ========== day_of_week_rules ==========
DROP POLICY IF EXISTS "Admin can delete day of week rules" ON public.day_of_week_rules;
DROP POLICY IF EXISTS "Admin can insert day of week rules" ON public.day_of_week_rules;
DROP POLICY IF EXISTS "Admin can update day of week rules" ON public.day_of_week_rules;
DROP POLICY IF EXISTS "Staff can view day of week rules" ON public.day_of_week_rules;

CREATE POLICY "Admin can delete day of week rules" ON public.day_of_week_rules FOR DELETE USING (is_admin());
CREATE POLICY "Admin can insert day of week rules" ON public.day_of_week_rules FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admin can update day of week rules" ON public.day_of_week_rules FOR UPDATE USING (is_admin());
CREATE POLICY "Staff can view day of week rules" ON public.day_of_week_rules FOR SELECT USING (is_staff());

-- ========== discount_code_usages ==========
DROP POLICY IF EXISTS "Staff can view discount usages" ON public.discount_code_usages;
DROP POLICY IF EXISTS "Write staff can insert discount usages" ON public.discount_code_usages;

CREATE POLICY "Staff can view discount usages" ON public.discount_code_usages FOR SELECT USING (is_staff());
CREATE POLICY "Write staff can insert discount usages" ON public.discount_code_usages FOR INSERT WITH CHECK (is_write_staff());

-- ========== ledger_lines ==========
DROP POLICY IF EXISTS "Admin can delete ledger lines" ON public.ledger_lines;
DROP POLICY IF EXISTS "Staff can view ledger lines" ON public.ledger_lines;
DROP POLICY IF EXISTS "Write staff can insert ledger lines" ON public.ledger_lines;
DROP POLICY IF EXISTS "Write staff can update ledger lines" ON public.ledger_lines;

CREATE POLICY "Admin can delete ledger lines" ON public.ledger_lines FOR DELETE USING (is_admin());
CREATE POLICY "Staff can view ledger lines" ON public.ledger_lines FOR SELECT USING (is_staff());
CREATE POLICY "Write staff can insert ledger lines" ON public.ledger_lines FOR INSERT WITH CHECK (is_write_staff());
CREATE POLICY "Write staff can update ledger lines" ON public.ledger_lines FOR UPDATE USING (is_write_staff());

-- ========== profiles ==========
DROP POLICY IF EXISTS "Staff can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Staff can view all profiles" ON public.profiles FOR SELECT USING (is_staff());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

-- ========== room_availability ==========
DROP POLICY IF EXISTS "Admin/Manager can delete room availability" ON public.room_availability;
DROP POLICY IF EXISTS "Staff can insert room availability" ON public.room_availability;
DROP POLICY IF EXISTS "Staff can update room availability" ON public.room_availability;
DROP POLICY IF EXISTS "Staff can view room availability" ON public.room_availability;

CREATE POLICY "Admin/Manager can delete room availability" ON public.room_availability FOR DELETE USING (is_admin() OR is_manager());
CREATE POLICY "Staff can insert room availability" ON public.room_availability FOR INSERT WITH CHECK (is_write_staff());
CREATE POLICY "Staff can update room availability" ON public.room_availability FOR UPDATE USING (is_write_staff());
CREATE POLICY "Staff can view room availability" ON public.room_availability FOR SELECT USING (is_staff());

-- ========== booking_transactions ==========
DROP POLICY IF EXISTS "Admin can delete booking transactions" ON public.booking_transactions;
DROP POLICY IF EXISTS "Staff can view booking transactions" ON public.booking_transactions;
DROP POLICY IF EXISTS "Write staff can insert booking transactions" ON public.booking_transactions;
DROP POLICY IF EXISTS "Write staff can update booking transactions" ON public.booking_transactions;

CREATE POLICY "Admin can delete booking transactions" ON public.booking_transactions FOR DELETE USING (is_admin());
CREATE POLICY "Staff can view booking transactions" ON public.booking_transactions FOR SELECT USING (is_staff());
CREATE POLICY "Write staff can insert booking transactions" ON public.booking_transactions FOR INSERT WITH CHECK (is_write_staff());
CREATE POLICY "Write staff can update booking transactions" ON public.booking_transactions FOR UPDATE USING (is_write_staff());

-- ========== guests ==========
DROP POLICY IF EXISTS "Admin can delete guests" ON public.guests;
DROP POLICY IF EXISTS "Secure guest access by role and property" ON public.guests;
DROP POLICY IF EXISTS "Staff can insert guests" ON public.guests;
DROP POLICY IF EXISTS "Staff can update guests" ON public.guests;

CREATE POLICY "Admin can delete guests" ON public.guests FOR DELETE USING (is_admin());
CREATE POLICY "Secure guest access by role and property" ON public.guests FOR SELECT USING (can_access_guest(property_id, id));
CREATE POLICY "Staff can insert guests" ON public.guests FOR INSERT WITH CHECK (is_write_staff());
CREATE POLICY "Staff can update guests" ON public.guests FOR UPDATE USING (is_write_staff());

-- ========== property_inventory_settings ==========
DROP POLICY IF EXISTS "Admin can delete inventory settings" ON public.property_inventory_settings;
DROP POLICY IF EXISTS "Only Admin can insert inventory settings" ON public.property_inventory_settings;
DROP POLICY IF EXISTS "Only Admin can update inventory settings" ON public.property_inventory_settings;
DROP POLICY IF EXISTS "Staff can view inventory settings" ON public.property_inventory_settings;

CREATE POLICY "Admin can delete inventory settings" ON public.property_inventory_settings FOR DELETE USING (is_admin());
CREATE POLICY "Only Admin can insert inventory settings" ON public.property_inventory_settings FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Only Admin can update inventory settings" ON public.property_inventory_settings FOR UPDATE USING (is_admin());
CREATE POLICY "Staff can view inventory settings" ON public.property_inventory_settings FOR SELECT USING (is_staff());

-- ========== guest_view_logs ==========
DROP POLICY IF EXISTS "Admin/Manager can view guest view logs" ON public.guest_view_logs;
DROP POLICY IF EXISTS "Staff can insert guest view logs" ON public.guest_view_logs;

CREATE POLICY "Admin/Manager can view guest view logs" ON public.guest_view_logs FOR SELECT USING (is_admin() OR is_manager());
CREATE POLICY "Staff can insert guest view logs" ON public.guest_view_logs FOR INSERT WITH CHECK (is_write_staff() AND (auth.uid() = user_id));

-- ========== channel_connections ==========
DROP POLICY IF EXISTS "Admin can delete channel connections" ON public.channel_connections;
DROP POLICY IF EXISTS "Admin/Manager can view channel connections" ON public.channel_connections;
DROP POLICY IF EXISTS "Admin/Manager can insert channel connections" ON public.channel_connections;
DROP POLICY IF EXISTS "Admin/Manager can update channel connections" ON public.channel_connections;

CREATE POLICY "Admin can delete channel connections" ON public.channel_connections FOR DELETE USING (is_admin());
CREATE POLICY "Admin/Manager can view channel connections" ON public.channel_connections FOR SELECT USING (is_admin() OR is_manager());
CREATE POLICY "Admin/Manager can insert channel connections" ON public.channel_connections FOR INSERT WITH CHECK (is_admin() OR is_manager());
CREATE POLICY "Admin/Manager can update channel connections" ON public.channel_connections FOR UPDATE USING (is_admin() OR is_manager());


-- 1. rate_plans
CREATE TABLE public.rate_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  base_price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'LKR',
  is_refundable boolean NOT NULL DEFAULT true,
  min_stay integer NOT NULL DEFAULT 1,
  max_stay integer,
  included_guests integer NOT NULL DEFAULT 2,
  extra_guest_fee numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rate_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view rate plans" ON public.rate_plans FOR SELECT TO authenticated USING (is_staff());
CREATE POLICY "Admin can insert rate plans" ON public.rate_plans FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admin can update rate plans" ON public.rate_plans FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Admin can delete rate plans" ON public.rate_plans FOR DELETE TO authenticated USING (is_admin());

-- 2. rate_plan_room_types
CREATE TABLE public.rate_plan_room_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_plan_id uuid NOT NULL REFERENCES public.rate_plans(id) ON DELETE CASCADE,
  room_type text NOT NULL,
  price_override numeric,
  UNIQUE (rate_plan_id, room_type)
);
ALTER TABLE public.rate_plan_room_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view rate plan room types" ON public.rate_plan_room_types FOR SELECT TO authenticated USING (is_staff());
CREATE POLICY "Admin can insert rate plan room types" ON public.rate_plan_room_types FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admin can update rate plan room types" ON public.rate_plan_room_types FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Admin can delete rate plan room types" ON public.rate_plan_room_types FOR DELETE TO authenticated USING (is_admin());

-- 3. seasonal_rules
CREATE TABLE public.seasonal_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  rate_plan_id uuid REFERENCES public.rate_plans(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  modifier_type text NOT NULL DEFAULT 'percent',
  modifier_value numeric NOT NULL DEFAULT 0,
  priority integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.seasonal_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view seasonal rules" ON public.seasonal_rules FOR SELECT TO authenticated USING (is_staff());
CREATE POLICY "Admin can insert seasonal rules" ON public.seasonal_rules FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admin can update seasonal rules" ON public.seasonal_rules FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Admin can delete seasonal rules" ON public.seasonal_rules FOR DELETE TO authenticated USING (is_admin());

-- 4. day_of_week_rules
CREATE TABLE public.day_of_week_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  rate_plan_id uuid REFERENCES public.rate_plans(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  modifier_type text NOT NULL DEFAULT 'percent',
  modifier_value numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true
);
ALTER TABLE public.day_of_week_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view day of week rules" ON public.day_of_week_rules FOR SELECT TO authenticated USING (is_staff());
CREATE POLICY "Admin can insert day of week rules" ON public.day_of_week_rules FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admin can update day of week rules" ON public.day_of_week_rules FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Admin can delete day of week rules" ON public.day_of_week_rules FOR DELETE TO authenticated USING (is_admin());

-- 5. rate_overrides
CREATE TABLE public.rate_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  room_type text NOT NULL,
  rate_plan_id uuid REFERENCES public.rate_plans(id) ON DELETE CASCADE,
  date date NOT NULL,
  price numeric NOT NULL,
  closed boolean NOT NULL DEFAULT false,
  min_stay integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (property_id, room_type, date)
);
ALTER TABLE public.rate_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view rate overrides" ON public.rate_overrides FOR SELECT TO authenticated USING (is_staff());
CREATE POLICY "Admin can insert rate overrides" ON public.rate_overrides FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admin can update rate overrides" ON public.rate_overrides FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Admin can delete rate overrides" ON public.rate_overrides FOR DELETE TO authenticated USING (is_admin());

-- 6. discount_codes
CREATE TABLE public.discount_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  code text NOT NULL,
  discount_type text NOT NULL DEFAULT 'percent',
  discount_value numeric NOT NULL DEFAULT 0,
  start_date date,
  end_date date,
  max_usage integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (property_id, code)
);
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view discount codes" ON public.discount_codes FOR SELECT TO authenticated USING (is_staff());
CREATE POLICY "Admin can insert discount codes" ON public.discount_codes FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admin can update discount codes" ON public.discount_codes FOR UPDATE TO authenticated USING (is_admin());
CREATE POLICY "Admin can delete discount codes" ON public.discount_codes FOR DELETE TO authenticated USING (is_admin());

-- 7. discount_code_usages
CREATE TABLE public.discount_code_usages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_code_id uuid NOT NULL REFERENCES public.discount_codes(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  used_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.discount_code_usages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view discount usages" ON public.discount_code_usages FOR SELECT TO authenticated USING (is_staff());
CREATE POLICY "Write staff can insert discount usages" ON public.discount_code_usages FOR INSERT TO authenticated WITH CHECK (is_write_staff());

-- Add updated_at triggers
CREATE TRIGGER update_rate_plans_updated_at BEFORE UPDATE ON public.rate_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_seasonal_rules_updated_at BEFORE UPDATE ON public.seasonal_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Also update clear_property_data to include rate tables
CREATE OR REPLACE FUNCTION public.clear_property_data(p_property_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  cnt_ledger_lines int;
  cnt_ledger_entries int;
  cnt_transactions int;
  cnt_feedback int;
  cnt_rate_plans int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can clear property data';
  END IF;

  DELETE FROM public.ledger_lines WHERE entry_id IN (
    SELECT id FROM public.ledger_entries WHERE property_id = p_property_id
  );
  GET DIAGNOSTICS cnt_ledger_lines = ROW_COUNT;

  DELETE FROM public.ledger_entries WHERE property_id = p_property_id;
  GET DIAGNOSTICS cnt_ledger_entries = ROW_COUNT;

  DELETE FROM public.booking_transactions WHERE property_id = p_property_id;
  GET DIAGNOSTICS cnt_transactions = ROW_COUNT;

  DELETE FROM public.payments WHERE property_id = p_property_id;
  GET DIAGNOSTICS cnt_payments = ROW_COUNT;

  DELETE FROM public.guest_services WHERE property_id = p_property_id;
  GET DIAGNOSTICS cnt_guest_services = ROW_COUNT;

  DELETE FROM public.guest_feedback WHERE property_id = p_property_id;
  GET DIAGNOSTICS cnt_feedback = ROW_COUNT;

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

  -- Clear rate management data
  DELETE FROM public.rate_overrides WHERE property_id = p_property_id;
  DELETE FROM public.seasonal_rules WHERE property_id = p_property_id;
  DELETE FROM public.day_of_week_rules WHERE property_id = p_property_id;
  DELETE FROM public.discount_codes WHERE property_id = p_property_id;
  DELETE FROM public.rate_plans WHERE property_id = p_property_id;
  GET DIAGNOSTICS cnt_rate_plans = ROW_COUNT;

  deleted_counts := jsonb_build_object(
    'payments', cnt_payments,
    'guest_services', cnt_guest_services,
    'guest_feedback', cnt_feedback,
    'invoices', cnt_invoices,
    'bookings', cnt_bookings,
    'guests', cnt_guests,
    'room_availability', cnt_availability,
    'sync_logs', cnt_sync_logs,
    'notifications', cnt_notifications,
    'ledger_lines', cnt_ledger_lines,
    'ledger_entries', cnt_ledger_entries,
    'booking_transactions', cnt_transactions,
    'rate_plans', cnt_rate_plans
  );

  RETURN deleted_counts;
END;
$$;

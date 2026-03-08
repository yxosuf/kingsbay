
-- Phase 1: Database migration for rate engine completion

-- 1. Add columns to bookings table
ALTER TABLE public.bookings 
  ADD COLUMN IF NOT EXISTS rate_plan_id uuid REFERENCES public.rate_plans(id),
  ADD COLUMN IF NOT EXISTS discount_code_id uuid REFERENCES public.discount_codes(id),
  ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS price_breakdown jsonb;

-- 2. Create occupancy_pricing_rules table
CREATE TABLE IF NOT EXISTS public.occupancy_pricing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  occupancy_threshold integer NOT NULL CHECK (occupancy_threshold >= 0 AND occupancy_threshold <= 100),
  modifier_type text NOT NULL DEFAULT 'percent',
  modifier_value numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.occupancy_pricing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view occupancy rules" ON public.occupancy_pricing_rules
  FOR SELECT USING (is_staff());
CREATE POLICY "Admin can insert occupancy rules" ON public.occupancy_pricing_rules
  FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admin can update occupancy rules" ON public.occupancy_pricing_rules
  FOR UPDATE USING (is_admin());
CREATE POLICY "Admin can delete occupancy rules" ON public.occupancy_pricing_rules
  FOR DELETE USING (is_admin());

-- 3. Create rate_change_logs table
CREATE TABLE IF NOT EXISTS public.rate_change_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rate_change_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view rate change logs" ON public.rate_change_logs
  FOR SELECT USING (is_admin());
CREATE POLICY "System can insert rate change logs" ON public.rate_change_logs
  FOR INSERT WITH CHECK (is_staff());

-- 4. Add composite index on rate_overrides for performance
CREATE INDEX IF NOT EXISTS idx_rate_overrides_property_room_date 
  ON public.rate_overrides(property_id, room_type, date);

-- 5. Add unique constraint for safe UPSERT on rate_overrides
-- First check if it exists (use DO block)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'rate_overrides_property_room_date_unique'
  ) THEN
    ALTER TABLE public.rate_overrides 
      ADD CONSTRAINT rate_overrides_property_room_date_unique 
      UNIQUE (property_id, room_type, date);
  END IF;
END $$;

-- 6. Audit triggers for rate changes
CREATE OR REPLACE FUNCTION public.log_rate_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_entity_type text;
  v_property_id uuid;
  v_user_id uuid;
BEGIN
  v_entity_type := TG_ARGV[0];
  v_user_id := COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid);

  IF TG_OP = 'DELETE' THEN
    v_property_id := OLD.property_id;
    INSERT INTO public.rate_change_logs (property_id, user_id, entity_type, entity_id, action, old_value, new_value)
    VALUES (v_property_id, v_user_id, v_entity_type, OLD.id, 'deleted', to_jsonb(OLD), NULL);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    v_property_id := NEW.property_id;
    INSERT INTO public.rate_change_logs (property_id, user_id, entity_type, entity_id, action, old_value, new_value)
    VALUES (v_property_id, v_user_id, v_entity_type, NEW.id, 'updated', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    v_property_id := NEW.property_id;
    INSERT INTO public.rate_change_logs (property_id, user_id, entity_type, entity_id, action, old_value, new_value)
    VALUES (v_property_id, v_user_id, v_entity_type, NEW.id, 'created', NULL, to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- Create triggers
CREATE TRIGGER trg_rate_plans_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.rate_plans
  FOR EACH ROW EXECUTE FUNCTION public.log_rate_change('rate_plan');

CREATE TRIGGER trg_seasonal_rules_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.seasonal_rules
  FOR EACH ROW EXECUTE FUNCTION public.log_rate_change('seasonal_rule');

CREATE TRIGGER trg_day_of_week_rules_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.day_of_week_rules
  FOR EACH ROW EXECUTE FUNCTION public.log_rate_change('day_of_week_rule');

CREATE TRIGGER trg_rate_overrides_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.rate_overrides
  FOR EACH ROW EXECUTE FUNCTION public.log_rate_change('rate_override');

CREATE TRIGGER trg_discount_codes_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.discount_codes
  FOR EACH ROW EXECUTE FUNCTION public.log_rate_change('discount_code');

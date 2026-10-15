
-- ===== Enums =====
CREATE TYPE public.plan_tier AS ENUM ('starter', 'pro', 'pro_plus');
CREATE TYPE public.org_status AS ENUM ('active', 'suspended', 'cancelled');
CREATE TYPE public.member_status AS ENUM ('invited', 'active', 'suspended');
CREATE TYPE public.platform_admin_level AS ENUM ('support', 'billing', 'superuser');
ALTER TYPE public.staff_role ADD VALUE IF NOT EXISTS 'housekeeping';

-- ===== Tables =====
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  owner_user_id uuid NOT NULL,
  plan public.plan_tier NOT NULL DEFAULT 'starter',
  status public.org_status NOT NULL DEFAULT 'active',
  base_currency text NOT NULL DEFAULT 'LKR',
  timezone text NOT NULL DEFAULT 'Asia/Colombo',
  onboarding_completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.staff_role NOT NULL,
  status public.member_status NOT NULL DEFAULT 'active',
  invited_by uuid,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id),
  UNIQUE (user_id)  -- v1: one company per staff member
);
GRANT SELECT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.platform_admins (
  user_id uuid PRIMARY KEY,
  level public.platform_admin_level NOT NULL DEFAULT 'superuser',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_admins TO authenticated;
GRANT ALL ON public.platform_admins TO service_role;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.support_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_admin_id uuid NOT NULL,
  org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  action text NOT NULL,
  reason text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  ip text
);
GRANT SELECT ON public.support_access_log TO authenticated;
GRANT ALL ON public.support_access_log TO service_role;
ALTER TABLE public.support_access_log ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.organization_creation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.organization_creation_log TO authenticated;
GRANT ALL ON public.organization_creation_log TO service_role;
ALTER TABLE public.organization_creation_log ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.usage_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  emails_ingested integer NOT NULL DEFAULT 0,
  ai_actions integer NOT NULL DEFAULT 0,
  whatsapp_messages integer NOT NULL DEFAULT 0,
  properties_count integer NOT NULL DEFAULT 0,
  rooms_count integer NOT NULL DEFAULT 0,
  UNIQUE (org_id, period_start)
);
GRANT SELECT ON public.usage_counters TO authenticated;
GRANT ALL ON public.usage_counters TO service_role;
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;

-- Frozen snapshot of legacy roles (no app reads)
CREATE TABLE public.user_roles_backup_2026_10 AS SELECT * FROM public.user_roles;
GRANT ALL ON public.user_roles_backup_2026_10 TO service_role;
ALTER TABLE public.user_roles_backup_2026_10 ENABLE ROW LEVEL SECURITY;

-- ===== Columns =====
ALTER TABLE public.properties ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.services ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
CREATE INDEX idx_properties_org ON public.properties(organization_id);
CREATE INDEX idx_services_org ON public.services(organization_id);
CREATE INDEX idx_org_members_user ON public.organization_members(user_id);

-- ===== Helper functions =====
CREATE OR REPLACE FUNCTION public.plan_rank(p public.plan_tier)
RETURNS int LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE p WHEN 'starter' THEN 1 WHEN 'pro' THEN 2 WHEN 'pro_plus' THEN 3 END
$$;

CREATE OR REPLACE FUNCTION public.current_org_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT org_id FROM public.organization_members
  WHERE user_id = auth.uid() AND status = 'active'
$$;

CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT org_id FROM public.organization_members
  WHERE user_id = auth.uid() AND status = 'active'
  ORDER BY joined_at LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members m
    JOIN public.organizations o ON o.id = m.org_id
    WHERE m.org_id = org AND m.user_id = auth.uid()
      AND m.status = 'active' AND o.status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION public.org_role(org uuid)
RETURNS public.staff_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.organization_members
  WHERE org_id = org AND user_id = auth.uid() AND status = 'active'
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.org_has_plan(org uuid, min_plan public.plan_tier)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT public.plan_rank(plan) >= public.plan_rank(min_plan)
                   FROM public.organizations WHERE id = org AND status = 'active'), false)
$$;

CREATE OR REPLACE FUNCTION public.assert_plan(org uuid, min_plan public.plan_tier)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.org_has_plan(org, min_plan) THEN
    RAISE EXCEPTION 'Plan upgrade required: % or higher', min_plan USING ERRCODE = 'P0402';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.property_org(prop uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM public.properties WHERE id = prop
$$;

-- Staff can only reach properties of their own company; non-staff (guest portal) fall back to their own policies.
CREATE OR REPLACE FUNCTION public.can_reach_property(prop uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT prop IS NULL
      OR NOT EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = auth.uid())
      OR public.is_org_member(public.property_org(prop))
$$;

CREATE OR REPLACE FUNCTION public.shares_org_with(other_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members a
    JOIN public.organization_members b ON a.org_id = b.org_id
    WHERE a.user_id = auth.uid() AND a.status = 'active' AND b.user_id = other_user
  )
$$;

-- ===== Legacy role helpers now read organization_members (single source of truth) =====
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.staff_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members m
    JOIN public.organizations o ON o.id = m.org_id
    WHERE m.user_id = _user_id AND m.role = _role AND m.status = 'active' AND o.status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members m
    JOIN public.organizations o ON o.id = m.org_id
    WHERE m.user_id = auth.uid() AND m.status = 'active' AND o.status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_write_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members m
    JOIN public.organizations o ON o.id = m.org_id
    WHERE m.user_id = auth.uid() AND m.status = 'active' AND o.status = 'active'
      AND m.role IN ('admin', 'manager', 'front_desk')
  )
$$;

CREATE OR REPLACE FUNCTION public.user_has_notification_access(notification_target_roles text[], notification_property_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_staff()
    AND public.can_reach_property(notification_property_id)
    AND (
      public.is_admin() OR public.is_manager()
      OR (
        (notification_target_roles IS NULL
          OR notification_target_roles && ARRAY[(SELECT role::text FROM public.organization_members WHERE user_id = auth.uid() LIMIT 1)])
        AND (notification_property_id IS NULL
          OR EXISTS (SELECT 1 FROM public.user_property_access WHERE user_id = auth.uid() AND property_id = notification_property_id))
      )
    )
$$;

-- Danger zone: admin of the property's own company only
CREATE OR REPLACE FUNCTION public.clear_property_data(p_property_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  deleted_counts jsonb;
  cnt_payments int; cnt_guest_services int; cnt_invoices int; cnt_bookings int; cnt_guests int;
  cnt_availability int; cnt_sync_logs int; cnt_notifications int; cnt_ledger_lines int;
  cnt_ledger_entries int; cnt_transactions int; cnt_feedback int; cnt_rate_plans int;
BEGIN
  IF public.org_role(public.property_org(p_property_id)) IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Only admins of this company can clear property data';
  END IF;

  DELETE FROM public.ledger_lines WHERE entry_id IN (SELECT id FROM public.ledger_entries WHERE property_id = p_property_id);
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
  DELETE FROM public.room_availability WHERE room_id IN (SELECT id FROM public.rooms WHERE property_id = p_property_id);
  GET DIAGNOSTICS cnt_availability = ROW_COUNT;
  DELETE FROM public.sync_logs WHERE channel_id IN (SELECT id FROM public.channel_connections WHERE property_id = p_property_id);
  GET DIAGNOSTICS cnt_sync_logs = ROW_COUNT;
  DELETE FROM public.bookings WHERE property_id = p_property_id;
  GET DIAGNOSTICS cnt_bookings = ROW_COUNT;
  DELETE FROM public.guest_view_logs WHERE property_id = p_property_id;
  DELETE FROM public.guests WHERE property_id = p_property_id;
  GET DIAGNOSTICS cnt_guests = ROW_COUNT;
  DELETE FROM public.notifications WHERE property_id = p_property_id;
  GET DIAGNOSTICS cnt_notifications = ROW_COUNT;
  DELETE FROM public.email_ingest_logs WHERE property_id = p_property_id;
  DELETE FROM public.rate_overrides WHERE property_id = p_property_id;
  DELETE FROM public.seasonal_rules WHERE property_id = p_property_id;
  DELETE FROM public.day_of_week_rules WHERE property_id = p_property_id;
  DELETE FROM public.discount_codes WHERE property_id = p_property_id;
  DELETE FROM public.rate_plans WHERE property_id = p_property_id;
  GET DIAGNOSTICS cnt_rate_plans = ROW_COUNT;

  deleted_counts := jsonb_build_object(
    'payments', cnt_payments, 'guest_services', cnt_guest_services, 'guest_feedback', cnt_feedback,
    'invoices', cnt_invoices, 'bookings', cnt_bookings, 'guests', cnt_guests,
    'room_availability', cnt_availability, 'sync_logs', cnt_sync_logs, 'notifications', cnt_notifications,
    'ledger_lines', cnt_ledger_lines, 'ledger_entries', cnt_ledger_entries,
    'booking_transactions', cnt_transactions, 'rate_plans', cnt_rate_plans);
  RETURN deleted_counts;
END;
$function$;

-- ===== Backfill Kings Bay as company #1 =====
DO $$
DECLARE
  v_org uuid;
  v_owner uuid;
BEGIN
  SELECT ur.user_id INTO v_owner FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.role = 'admin' ORDER BY ur.created_at LIMIT 1;

  IF v_owner IS NULL THEN
    SELECT id INTO v_owner FROM public.profiles ORDER BY created_at LIMIT 1;
  END IF;

  IF v_owner IS NOT NULL THEN
    INSERT INTO public.organizations (name, slug, owner_user_id, plan, onboarding_completed_at)
    VALUES ('Kings Bay', 'kings-bay', v_owner, 'pro_plus', now())
    RETURNING id INTO v_org;

    UPDATE public.properties SET organization_id = v_org WHERE organization_id IS NULL;
    UPDATE public.services SET organization_id = v_org WHERE organization_id IS NULL;

    INSERT INTO public.organization_members (org_id, user_id, role, status)
    SELECT DISTINCT ON (ur.user_id) v_org, ur.user_id, ur.role, 'active'
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    ORDER BY ur.user_id, ur.created_at;
  END IF;
END $$;

ALTER TABLE public.properties ALTER COLUMN organization_id SET NOT NULL;

COMMENT ON TABLE public.user_roles IS 'DEPRECATED: replaced by organization_members. No app reads. Snapshot in user_roles_backup_2026_10.';

-- ===== Org assignment triggers =====
CREATE OR REPLACE FUNCTION public.set_property_org()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.organization_id IS NULL THEN
      NEW.organization_id := public.current_org_id();
    END IF;
    IF NEW.organization_id IS NULL THEN
      RAISE EXCEPTION 'A property must belong to a company';
    END IF;
  ELSIF NEW.organization_id IS DISTINCT FROM OLD.organization_id AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Properties cannot be moved between companies';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_set_property_org BEFORE INSERT OR UPDATE ON public.properties
FOR EACH ROW EXECUTE FUNCTION public.set_property_org();

CREATE OR REPLACE FUNCTION public.set_service_org()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.organization_id IS NULL THEN
    NEW.organization_id := public.current_org_id();
  ELSIF TG_OP = 'UPDATE' AND NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    NEW.organization_id := OLD.organization_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_set_service_org BEFORE INSERT OR UPDATE ON public.services
FOR EACH ROW EXECUTE FUNCTION public.set_service_org();

CREATE OR REPLACE FUNCTION public.guard_org_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    NEW.plan := OLD.plan;
    NEW.status := OLD.status;
    NEW.owner_user_id := OLD.owner_user_id;
    NEW.slug := OLD.slug;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_guard_org_update BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.guard_org_update();

CREATE OR REPLACE FUNCTION public.guard_member_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.org_id := OLD.org_id;
  NEW.user_id := OLD.user_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_guard_member_update BEFORE UPDATE ON public.organization_members
FOR EACH ROW EXECUTE FUNCTION public.guard_member_update();

-- ===== RLS for new tables =====
CREATE POLICY "Members view own company" ON public.organizations FOR SELECT TO authenticated
  USING (public.is_org_member(id));
CREATE POLICY "Company admins update company" ON public.organizations FOR UPDATE TO authenticated
  USING (public.org_role(id) = 'admin') WITH CHECK (public.org_role(id) = 'admin');

CREATE POLICY "View own or same-company members" ON public.organization_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_org_member(org_id));
CREATE POLICY "Company admins update other members" ON public.organization_members FOR UPDATE TO authenticated
  USING (public.org_role(org_id) = 'admin' AND user_id <> auth.uid())
  WITH CHECK (public.org_role(org_id) = 'admin' AND user_id <> auth.uid());
CREATE POLICY "Company admins remove other members" ON public.organization_members FOR DELETE TO authenticated
  USING (public.org_role(org_id) = 'admin' AND user_id <> auth.uid());

CREATE POLICY "Platform admins see own row" ON public.platform_admins FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Platform admins read support log" ON public.support_access_log FOR SELECT TO authenticated
  USING (public.is_platform_admin());
CREATE POLICY "Platform admins read creation log" ON public.organization_creation_log FOR SELECT TO authenticated
  USING (public.is_platform_admin());
CREATE POLICY "Members read own usage" ON public.usage_counters FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));

-- ===== Company isolation layer (RESTRICTIVE, on top of existing role policies) =====
CREATE POLICY "Company isolation" ON public.properties AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = auth.uid()) OR public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id) OR public.is_platform_admin());

CREATE POLICY "Company isolation" ON public.services AS RESTRICTIVE FOR ALL TO authenticated
  USING (organization_id IS NULL OR NOT public.is_staff() OR public.is_org_member(organization_id))
  WITH CHECK (organization_id IS NULL OR public.is_org_member(organization_id));

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'audit_logs','booking_transactions','bookings','channel_connections','day_of_week_rules',
    'discount_codes','email_ingest_logs','guest_communications','guest_feedback','guest_services',
    'guest_view_logs','guests','housekeeping_checklists','housekeeping_task_instances','invoices',
    'ledger_accounts','ledger_entries','notifications','occupancy_pricing_rules','ota_integrations',
    'ota_sync_logs','passport_photos','payments','property_inventory_settings','rate_change_logs',
    'rate_overrides','rate_plans','rooms','seasonal_rules','user_property_access']
  LOOP
    EXECUTE format(
      'CREATE POLICY "Company isolation" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated
         USING (public.can_reach_property(property_id))
         WITH CHECK (public.can_reach_property(property_id))', t);
  END LOOP;
END $$;

CREATE POLICY "Company isolation" ON public.room_availability AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.can_reach_property((SELECT property_id FROM public.rooms r WHERE r.id = room_id)))
  WITH CHECK (public.can_reach_property((SELECT property_id FROM public.rooms r WHERE r.id = room_id)));
CREATE POLICY "Company isolation" ON public.channel_room_mappings AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.can_reach_property((SELECT property_id FROM public.channel_connections c WHERE c.id = channel_connection_id)))
  WITH CHECK (public.can_reach_property((SELECT property_id FROM public.channel_connections c WHERE c.id = channel_connection_id)));
CREATE POLICY "Company isolation" ON public.sync_logs AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.can_reach_property((SELECT property_id FROM public.channel_connections c WHERE c.id = channel_id)))
  WITH CHECK (public.can_reach_property((SELECT property_id FROM public.channel_connections c WHERE c.id = channel_id)));
CREATE POLICY "Company isolation" ON public.ledger_lines AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.can_reach_property((SELECT property_id FROM public.ledger_entries e WHERE e.id = entry_id)))
  WITH CHECK (public.can_reach_property((SELECT property_id FROM public.ledger_entries e WHERE e.id = entry_id)));
CREATE POLICY "Company isolation" ON public.rate_plan_room_types AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.can_reach_property((SELECT property_id FROM public.rate_plans p WHERE p.id = rate_plan_id)))
  WITH CHECK (public.can_reach_property((SELECT property_id FROM public.rate_plans p WHERE p.id = rate_plan_id)));
CREATE POLICY "Company isolation" ON public.discount_code_usages AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.can_reach_property((SELECT property_id FROM public.discount_codes d WHERE d.id = discount_code_id)))
  WITH CHECK (public.can_reach_property((SELECT property_id FROM public.discount_codes d WHERE d.id = discount_code_id)));

-- Profiles: only self or same-company colleagues
CREATE POLICY "Company isolation" ON public.profiles AS RESTRICTIVE FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.shares_org_with(id));

-- ===== RPCs =====
CREATE OR REPLACE FUNCTION public.create_organization_with_owner(p_name text, p_user_agent text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid;
  v_slug text;
  v_ip text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF p_name IS NULL OR length(trim(p_name)) < 2 OR length(p_name) > 100 THEN
    RAISE EXCEPTION 'Company name must be 2-100 characters';
  END IF;
  IF EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = v_uid) THEN
    RAISE EXCEPTION 'You already belong to a company';
  END IF;
  IF EXISTS (SELECT 1 FROM public.guests WHERE auth_user_id = v_uid) THEN
    RAISE EXCEPTION 'Guest accounts cannot create a company';
  END IF;
  IF NOT public.is_platform_admin() AND EXISTS (
    SELECT 1 FROM public.organization_creation_log
    WHERE user_id = v_uid AND created_at > now() - interval '24 hours') THEN
    RAISE EXCEPTION 'Only one company can be created per 24 hours';
  END IF;

  v_slug := trim(both '-' from regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g'));
  IF v_slug = '' THEN v_slug := 'company'; END IF;
  v_slug := v_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

  BEGIN
    v_ip := split_part(current_setting('request.headers', true)::json->>'x-forwarded-for', ',', 1);
  EXCEPTION WHEN OTHERS THEN v_ip := NULL;
  END;

  INSERT INTO public.organizations (name, slug, owner_user_id)
  VALUES (trim(p_name), v_slug, v_uid) RETURNING id INTO v_org;

  INSERT INTO public.organization_members (org_id, user_id, role, status)
  VALUES (v_org, v_uid, 'admin', 'active');

  INSERT INTO public.organization_creation_log (user_id, org_id, ip, user_agent)
  VALUES (v_uid, v_org, v_ip, left(p_user_agent, 500));

  RETURN v_org;
END;
$$;
REVOKE ALL ON FUNCTION public.create_organization_with_owner(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_organization_with_owner(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.add_org_member_by_email(p_email text, p_role public.staff_role)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_org uuid := public.current_org_id();
  v_target uuid;
BEGIN
  IF v_org IS NULL OR public.org_role(v_org) <> 'admin' THEN
    RAISE EXCEPTION 'Only company admins can add staff';
  END IF;
  SELECT id INTO v_target FROM public.profiles WHERE lower(email) = lower(trim(p_email)) LIMIT 1;
  IF v_target IS NULL THEN
    RAISE EXCEPTION 'No account found for that email. Ask them to sign up first.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = v_target) THEN
    RAISE EXCEPTION 'This person already belongs to a company';
  END IF;
  INSERT INTO public.organization_members (org_id, user_id, role, status, invited_by)
  VALUES (v_org, v_target, p_role, 'active', auth.uid());
  RETURN v_target;
END;
$$;
REVOKE ALL ON FUNCTION public.add_org_member_by_email(text, public.staff_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_org_member_by_email(text, public.staff_role) TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_list_organizations()
RETURNS TABLE(id uuid, name text, slug text, plan public.plan_tier, status public.org_status,
              created_at timestamptz, property_count bigint, member_count bigint, room_count bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  INSERT INTO public.support_access_log (platform_admin_id, action, reason, ended_at)
  VALUES (auth.uid(), 'list_organizations', 'platform dashboard view', now());
  RETURN QUERY
  SELECT o.id, o.name, o.slug, o.plan, o.status, o.created_at,
    (SELECT count(*) FROM public.properties p WHERE p.organization_id = o.id),
    (SELECT count(*) FROM public.organization_members m WHERE m.org_id = o.id),
    (SELECT count(*) FROM public.rooms r JOIN public.properties p ON p.id = r.property_id WHERE p.organization_id = o.id)
  FROM public.organizations o ORDER BY o.created_at;
END;
$$;
REVOKE ALL ON FUNCTION public.platform_list_organizations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_list_organizations() TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_update_organization(p_org uuid, p_plan public.plan_tier, p_status public.org_status, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN RAISE EXCEPTION 'A reason is required'; END IF;
  UPDATE public.organizations SET plan = p_plan, status = p_status WHERE id = p_org;
  INSERT INTO public.support_access_log (platform_admin_id, org_id, action, reason, ended_at)
  VALUES (auth.uid(), p_org, format('set plan=%s status=%s', p_plan, p_status), p_reason, now());
END;
$$;
REVOKE ALL ON FUNCTION public.platform_update_organization(uuid, public.plan_tier, public.org_status, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_update_organization(uuid, public.plan_tier, public.org_status, text) TO authenticated;

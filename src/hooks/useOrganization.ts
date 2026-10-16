import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type PlanTier = 'starter' | 'pro' | 'pro_plus';

export const PLAN_RANK: Record<PlanTier, number> = { starter: 1, pro: 2, pro_plus: 3 };
export const PLAN_LABEL: Record<PlanTier, string> = { starter: 'Starter', pro: 'Pro', pro_plus: 'Pro+' };

/** Feature → minimum plan. UI hint only; the server enforces the same rules. */
export const FEATURE_PLAN = {
  ical_sync: 'starter',
  email_ingestion: 'pro',
  branded_invoice: 'pro',
  ai_agent: 'pro_plus',
  whatsapp_alerts: 'pro_plus',
} as const satisfies Record<string, PlanTier>;
export type Feature = keyof typeof FEATURE_PLAN;

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: PlanTier;
  status: 'active' | 'suspended' | 'cancelled';
  base_currency: string;
  timezone: string;
  onboarding_completed_at: string | null;
}

export function useOrganization() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: organization = null, isLoading } = useQuery({
    queryKey: ['organization', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: m } = await supabase
        .from('organization_members')
        .select('org_id')
        .eq('user_id', user!.id)
        .eq('status', 'active')
        .maybeSingle();
      if (!m) return null;
      const { data, error } = await supabase.from('organizations').select('*').eq('id', m.org_id).maybeSingle();
      if (error) throw error;
      return data as Organization | null;
    },
  });

  const { data: isPlatformAdmin = false } = useQuery({
    queryKey: ['platform-admin', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('platform_admins').select('user_id').eq('user_id', user!.id).maybeSingle();
      return !!data;
    },
  });

  const hasFeature = (feature: Feature) =>
    !!organization && PLAN_RANK[organization.plan] >= PLAN_RANK[FEATURE_PLAN[feature]];

  return {
    organization,
    loading: isLoading,
    isPlatformAdmin,
    hasFeature,
    refetch: () => qc.invalidateQueries({ queryKey: ['organization'] }),
  };
}

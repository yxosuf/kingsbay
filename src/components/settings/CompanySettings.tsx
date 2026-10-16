import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization, PLAN_LABEL, FEATURE_PLAN, PLAN_RANK } from '@/hooks/useOrganization';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Check, Lock } from 'lucide-react';

const FEATURE_LABEL: Record<keyof typeof FEATURE_PLAN, string> = {
  ical_sync: 'Calendar (iCal) sync',
  email_ingestion: 'Automatic booking import from emails',
  branded_invoice: 'Branded invoices',
  ai_agent: 'AI operations agent',
  whatsapp_alerts: 'WhatsApp alerts',
};

export function CompanySettings() {
  const { isAdmin } = useAuth();
  const { organization, refetch } = useOrganization();
  const [name, setName] = useState('');
  const [counts, setCounts] = useState({ properties: 0, members: 0 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!organization) return;
    setName(organization.name);
    Promise.all([
      supabase.from('properties').select('id', { count: 'exact', head: true }).eq('organization_id', organization.id),
      supabase.from('organization_members').select('id', { count: 'exact', head: true }).eq('org_id', organization.id),
    ]).then(([p, m]) => setCounts({ properties: p.count || 0, members: m.count || 0 }));
  }, [organization]);

  if (!organization) return null;

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('organizations').update({ name: name.trim() }).eq('id', organization.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Company updated');
    refetch();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Company</CardTitle>
          <CardDescription>Your business account. Everything you add belongs only to this company.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 max-w-md">
            <Label htmlFor="org-name">Company name</Label>
            <div className="flex gap-2">
              <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} disabled={!isAdmin} maxLength={100} />
              {isAdmin && <Button onClick={save} disabled={saving || name.trim().length < 2}>Save</Button>}
            </div>
          </div>
          <div className="flex flex-wrap gap-6 text-sm">
            <div><span className="text-muted-foreground">Plan</span> <Badge>{PLAN_LABEL[organization.plan]}</Badge></div>
            <div><span className="text-muted-foreground">Properties</span> <strong>{counts.properties}</strong></div>
            <div><span className="text-muted-foreground">Staff</span> <strong>{counts.members}</strong></div>
            <div><span className="text-muted-foreground">Status</span> <strong className="capitalize">{organization.status}</strong></div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Plan features</CardTitle>
          <CardDescription>Manage staff under Access & Roles. To change plan, contact us.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(Object.keys(FEATURE_PLAN) as (keyof typeof FEATURE_PLAN)[]).map((f) => {
            const ok = PLAN_RANK[organization.plan] >= PLAN_RANK[FEATURE_PLAN[f]];
            return (
              <div key={f} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  {ok ? <Check className="h-4 w-4 text-success" /> : <Lock className="h-4 w-4 text-muted-foreground" />}
                  {FEATURE_LABEL[f]}
                </span>
                <Badge variant="outline">{PLAN_LABEL[FEATURE_PLAN[f]]}</Badge>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

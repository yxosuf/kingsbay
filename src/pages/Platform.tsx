import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useOrganization, PLAN_LABEL, type PlanTier } from '@/hooks/useOrganization';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

type OrgStatus = 'active' | 'suspended' | 'cancelled';

export default function Platform() {
  const { isPlatformAdmin } = useOrganization();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const { data: orgs = [], error, isLoading } = useQuery({
    queryKey: ['platform-orgs'],
    enabled: isPlatformAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('platform_list_organizations');
      if (error) throw error;
      return data || [];
    },
  });

  const update = async (id: string, plan: PlanTier, status: OrgStatus) => {
    const reason = window.prompt('Reason for this change (saved in the support log):');
    if (!reason) return;
    setBusy(id);
    const { error } = await supabase.rpc('platform_update_organization', { p_org: id, p_plan: plan, p_status: status, p_reason: reason });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success('Company updated');
    qc.invalidateQueries({ queryKey: ['platform-orgs'] });
  };

  return (
    <DashboardLayout title="Platform">
      {!isPlatformAdmin ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">You don't have access to this page.</CardContent></Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Companies</CardTitle>
            <CardDescription>Only company-level info is shown here. Guest details, bookings and revenue stay private to each company. Every view and change is logged.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <p className="text-muted-foreground">Loading…</p> : error ? <p className="text-destructive">{(error as Error).message}</p> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead><TableHead>Properties</TableHead><TableHead>Rooms</TableHead>
                    <TableHead>Staff</TableHead><TableHead>Plan</TableHead><TableHead>Status</TableHead><TableHead>Since</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orgs.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">{o.name}</TableCell>
                      <TableCell>{o.property_count}</TableCell>
                      <TableCell>{o.room_count}</TableCell>
                      <TableCell>{o.member_count}</TableCell>
                      <TableCell>
                        <Select value={o.plan} disabled={busy === o.id} onValueChange={(v) => update(o.id, v as PlanTier, o.status as OrgStatus)}>
                          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                          <SelectContent>{(['starter', 'pro', 'pro_plus'] as PlanTier[]).map((p) => <SelectItem key={p} value={p}>{PLAN_LABEL[p]}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select value={o.status} disabled={busy === o.id} onValueChange={(v) => update(o.id, o.plan as PlanTier, v as OrgStatus)}>
                          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="suspended">Suspended</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell><Badge variant="outline">{new Date(o.created_at).toLocaleDateString()}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </DashboardLayout>
  );
}

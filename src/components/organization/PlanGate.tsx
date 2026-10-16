import { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useOrganization, FEATURE_PLAN, PLAN_LABEL, type Feature } from '@/hooks/useOrganization';

/** UX-only gate. The server enforces the same plan rules. */
export function PlanGate({ feature, children }: { feature: Feature; children: ReactNode }) {
  const { hasFeature, loading } = useOrganization();
  if (loading) return null;
  if (hasFeature(feature)) return <>{children}</>;
  const needed = PLAN_LABEL[FEATURE_PLAN[feature]];
  return (
    <Card className="border-dashed">
      <CardContent className="py-8 flex flex-col items-center text-center gap-2">
        <Lock className="h-6 w-6 text-muted-foreground" />
        <p className="font-medium">This feature needs the <Badge variant="secondary">{needed}</Badge> plan</p>
        <p className="text-sm text-muted-foreground">Contact us to upgrade your company plan.</p>
      </CardContent>
    </Card>
  );
}

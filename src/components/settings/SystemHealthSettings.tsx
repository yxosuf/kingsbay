import { useState, useEffect, useCallback, createElement } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CheckCircle2, XCircle, AlertTriangle, RefreshCw, Database, Shield,
  TrendingUp, Radio, Brush, UserCheck, BookOpen,
} from 'lucide-react';
import { useProperty } from '@/hooks/useProperty';
import { toast } from 'sonner';
import { HealthCategorySection } from './health/HealthCategorySection';
import type { HealthCategory } from './health/types';
import { runCoreChecks } from './health/coreChecks';
import { runBookingChecks } from './health/bookingChecks';
import { runRateChecks } from './health/rateChecks';
import { runChannelChecks } from './health/channelChecks';
import { runHousekeepingChecks } from './health/housekeepingChecks';
import { runGuestChecks } from './health/guestChecks';
import { runFinancialChecks } from './health/financialChecks';

export function SystemHealthSettings() {
  const { selectedProperty } = useProperty();
  const [categories, setCategories] = useState<HealthCategory[]>([]);
  const [running, setRunning] = useState(false);

  const runHealthChecks = useCallback(async () => {
    setRunning(true);
    const pid = selectedProperty?.id || null;

    const [core, booking, rate, channel, housekeeping, guest, financial] = await Promise.all([
      runCoreChecks(pid),
      runBookingChecks(pid),
      runRateChecks(pid),
      runChannelChecks(pid),
      runHousekeepingChecks(pid),
      runGuestChecks(pid),
      runFinancialChecks(),
    ]);

    setCategories([
      { id: 'core', label: 'Core Infrastructure', icon: createElement(Database, { className: 'h-4 w-4' }), checks: core },
      { id: 'booking', label: 'Booking Engine', icon: createElement(Shield, { className: 'h-4 w-4' }), checks: booking },
      { id: 'rate', label: 'Rate Engine', icon: createElement(TrendingUp, { className: 'h-4 w-4' }), checks: rate },
      { id: 'channel', label: 'Channel Sync', icon: createElement(Radio, { className: 'h-4 w-4' }), checks: channel },
      { id: 'housekeeping', label: 'Housekeeping', icon: createElement(Brush, { className: 'h-4 w-4' }), checks: housekeeping },
      { id: 'guest', label: 'Guest & Compliance', icon: createElement(UserCheck, { className: 'h-4 w-4' }), checks: guest },
      { id: 'financial', label: 'Financial Integrity', icon: createElement(BookOpen, { className: 'h-4 w-4' }), checks: financial },
    ]);

    setRunning(false);
    toast.success('Health checks complete');
  }, [selectedProperty]);

  useEffect(() => { runHealthChecks(); }, [runHealthChecks]);

  const allChecks = categories.flatMap(c => c.checks);
  const passCount = allChecks.filter(c => c.status === 'pass').length;
  const warnCount = allChecks.filter(c => c.status === 'warn').length;
  const failCount = allChecks.filter(c => c.status === 'fail').length;

  return (
    <div className="space-y-6">
      {/* Summary + Re-run */}
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-3 gap-4 flex-1 mr-4">
          <Card className="border-l-4 border-l-success">
            <CardContent className="py-4 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <div>
                <p className="text-2xl font-bold">{passCount}</p>
                <p className="text-xs text-muted-foreground">Passed</p>
              </div>
            </CardContent>
          </Card>
          <Card className={`border-l-4 ${warnCount > 0 ? 'border-l-warning' : 'border-l-muted'}`}>
            <CardContent className="py-4 flex items-center gap-3">
              <AlertTriangle className={`h-5 w-5 ${warnCount > 0 ? 'text-warning-foreground' : 'text-muted-foreground'}`} />
              <div>
                <p className="text-2xl font-bold">{warnCount}</p>
                <p className="text-xs text-muted-foreground">Warnings</p>
              </div>
            </CardContent>
          </Card>
          <Card className={`border-l-4 ${failCount > 0 ? 'border-l-destructive' : 'border-l-muted'}`}>
            <CardContent className="py-4 flex items-center gap-3">
              <XCircle className={`h-5 w-5 ${failCount > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
              <div>
                <p className="text-2xl font-bold">{failCount}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </CardContent>
          </Card>
        </div>
        <Button variant="outline" size="sm" onClick={runHealthChecks} disabled={running} className="shrink-0">
          <RefreshCw className={`h-4 w-4 mr-1 ${running ? 'animate-spin' : ''}`} />
          Re-run
        </Button>
      </div>

      {/* Categories */}
      {running && categories.length === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="rounded-xl border bg-card p-4 space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-72" />
              <Skeleton className="h-4 w-64" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map(cat => (
            <HealthCategorySection
              key={cat.id}
              category={cat}
              defaultOpen={cat.checks.some(c => c.status === 'fail' || c.status === 'warn')}
            />
          ))}
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { ChevronDown, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { HealthCategory, HealthCheck } from './types';

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = { pass: 'bg-success', warn: 'bg-warning', fail: 'bg-destructive' };
  return (
    <span className="relative flex h-3 w-3 shrink-0">
      {status === 'fail' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive/60" />}
      <span className={`relative inline-flex rounded-full h-3 w-3 ${colors[status] || 'bg-muted'}`} />
    </span>
  );
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'pass': return <CheckCircle2 className="h-4 w-4 text-success" />;
    case 'warn': return <AlertTriangle className="h-4 w-4 text-warning-foreground" />;
    case 'fail': return <XCircle className="h-4 w-4 text-destructive" />;
    default: return <Skeleton className="h-4 w-4 rounded-full" />;
  }
}

interface Props {
  category: HealthCategory;
  defaultOpen?: boolean;
}

export function HealthCategorySection({ category, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const passCount = category.checks.filter(c => c.status === 'pass').length;
  const warnCount = category.checks.filter(c => c.status === 'warn').length;
  const failCount = category.checks.filter(c => c.status === 'fail').length;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-xl border bg-card">
      <CollapsibleTrigger className="flex w-full items-center justify-between p-4 hover:bg-muted/30 transition-colors rounded-xl">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            {category.icon}
          </div>
          <span className="font-medium text-sm">{category.label}</span>
        </div>
        <div className="flex items-center gap-2">
          {failCount > 0 && <Badge variant="destructive" className="text-[10px] px-1.5">{failCount} fail</Badge>}
          {warnCount > 0 && <Badge variant="warning" className="text-[10px] px-1.5">{warnCount} warn</Badge>}
          {passCount > 0 && <Badge variant="success" className="text-[10px] px-1.5">{passCount} pass</Badge>}
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-4 pb-4 space-y-1">
          {category.checks.map((check, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-muted/50 ${check.status === 'fail' ? 'bg-destructive/5' : ''}`}
            >
              <StatusDot status={check.status} />
              <div className="flex items-center gap-2 text-muted-foreground">{check.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{check.name}</p>
                  <StatusIcon status={check.status} />
                </div>
                {check.detail && (
                  <p className={`text-xs mt-0.5 ${check.status === 'fail' ? 'text-destructive' : check.status === 'warn' ? 'text-warning-foreground' : 'text-muted-foreground'}`}>
                    {check.detail}
                  </p>
                )}
              </div>
              <Badge
                variant={check.status === 'pass' ? 'success' : check.status === 'warn' ? 'warning' : 'destructive'}
                className="text-[10px] shrink-0"
              >
                {check.status.toUpperCase()}
              </Badge>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

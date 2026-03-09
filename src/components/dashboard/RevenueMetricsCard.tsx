import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KpiCard } from '@/components/ui/KpiCard';
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay';
import { Wallet, TrendingUp, Calendar, BarChart3 } from 'lucide-react';
import type { RevenueMetrics, RoomMetrics } from '@/hooks/useDashboardKpi';

interface RevenueMetricsCardProps {
  revenue: RevenueMetrics;
  rooms: RoomMetrics;
  fxRate?: number | null;
}

export function RevenueMetricsCard({ revenue, rooms, fxRate }: RevenueMetricsCardProps) {
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const dayOfMonth = new Date().getDate();
  
  // ADR = Revenue / number of rooms sold (invoices as proxy)
  const adr = revenue.invoices_month > 0 ? Math.round(revenue.revenue_month / revenue.invoices_month) : 0;
  
  // RevPAR = Revenue / (available rooms × days elapsed in month)
  const revpar = rooms.available_rooms > 0 && dayOfMonth > 0
    ? Math.round(revenue.revenue_month / (rooms.available_rooms * dayOfMonth))
    : 0;

  const metrics = [
    { label: 'Today', amount: revenue.revenue_today, icon: Wallet, variant: 'primary' as const },
    { label: 'This Week', amount: revenue.revenue_week, icon: Calendar, variant: 'info' as const },
    { label: 'This Month', amount: revenue.revenue_month, icon: TrendingUp, variant: 'success' as const },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <Wallet className="h-4 w-4 sm:h-5 sm:w-5 text-success" />
          Revenue Metrics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {metrics.map((m) => (
            <KpiCard key={m.label} colorVariant={m.variant}>
              <div className="p-2.5 sm:p-4">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <m.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-[10px] sm:text-xs text-muted-foreground font-medium">{m.label}</p>
                </div>
                <CurrencyDisplay amount={m.amount} fxRate={fxRate} size="sm" />
              </div>
            </KpiCard>
          ))}
        </div>
        
        {/* ADR & RevPAR */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t">
          <div className="text-center">
            <p className="text-[10px] sm:text-xs text-muted-foreground font-medium mb-1">ADR</p>
            <CurrencyDisplay amount={adr} fxRate={fxRate} size="sm" className="justify-center" />
          </div>
          <div className="text-center">
            <p className="text-[10px] sm:text-xs text-muted-foreground font-medium mb-1">RevPAR</p>
            <CurrencyDisplay amount={revpar} fxRate={fxRate} size="sm" className="justify-center" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

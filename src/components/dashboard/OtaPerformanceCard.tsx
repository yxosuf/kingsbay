import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { Building2 } from 'lucide-react';
import type { KpiMetrics } from '@/hooks/useDashboardKpi';

interface OtaPerformanceCardProps {
  kpi: KpiMetrics;
  fxRate?: number | null;
}

export function OtaPerformanceCard({ kpi, fxRate }: OtaPerformanceCardProps) {
  const data = [
    { name: 'Booking.com', bookings: kpi.bookingcom_bookings_month },
    { name: 'Airbnb', bookings: kpi.airbnb_bookings_month },
    { name: 'Agoda', bookings: kpi.agoda_bookings_month },
    { name: 'Expedia', bookings: kpi.expedia_bookings_month },
  ];

  const totalOta = kpi.ota_bookings_month;
  const totalRevenue = kpi.ota_revenue_month;
  const totalCommission = kpi.ota_commission_month;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-warning" />
          OTA Performance
          <span className="text-xs font-normal text-muted-foreground ml-auto">This Month</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <p className="text-[10px] sm:text-xs text-muted-foreground">Bookings</p>
            <p className="text-lg font-bold">{totalOta}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] sm:text-xs text-muted-foreground">Revenue</p>
            <CurrencyDisplay amount={totalRevenue} fxRate={fxRate} size="sm" className="justify-center" />
          </div>
          <div className="text-center">
            <p className="text-[10px] sm:text-xs text-muted-foreground">Commission</p>
            <CurrencyDisplay amount={totalCommission} fxRate={fxRate} size="sm" className="justify-center" />
          </div>
        </div>

        {/* Bar Chart */}
        {totalOta > 0 ? (
          <div className="h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="bookings" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground">No OTA bookings this month</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

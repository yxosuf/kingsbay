import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KpiCard } from '@/components/ui/KpiCard';
import { Button } from '@/components/ui/button';
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useFxRate } from '@/hooks/useFxRate';
import { format, eachDayOfInterval, parseISO } from 'date-fns';
import { Download, Wallet, TrendingUp, BedDouble, Sparkles, Receipt, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { toast } from 'sonner';

interface RevenueReportProps {
  dateRange: { from: Date; to: Date };
  propertyId: string | null;
  showAllProperties: boolean;
  propertyName: string;
}

interface RevenueData {
  totalRevenue: number;
  roomRevenue: number;
  serviceRevenue: number;
  taxCollected: number;
  totalPayments: number;
  totalRefunds: number;
  netCashflow: number;
  invoiceCount: number;
  byMethod: Record<string, number>;
  bySource: Record<string, number>;
  dailyRevenue: { date: string; revenue: number }[];
}

const CHART_COLORS = [
  'hsl(25, 100%, 8%)',    // primary
  'hsl(145, 60%, 35%)',   // success
  'hsl(38, 85%, 48%)',    // warning
  'hsl(210, 60%, 50%)',   // info
  'hsl(0, 65%, 50%)',     // destructive
  'hsl(35, 25%, 60%)',    // muted
];

export function RevenueReport({ dateRange, propertyId, showAllProperties, propertyName }: RevenueReportProps) {
  const { fxRate } = useFxRate(propertyId);
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [dateRange, propertyId, showAllProperties]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const fromDate = format(dateRange.from, 'yyyy-MM-dd');
      const toDate = format(dateRange.to, 'yyyy-MM-dd');

      // Fetch invoices for revenue breakdown
      let invoiceQuery = supabase
        .from('invoices')
        .select('total_amount, room_charges, service_charges, tax_amount, created_at, property_id')
        .gte('created_at', fromDate)
        .lte('created_at', toDate + 'T23:59:59');
      if (propertyId && !showAllProperties) {
        invoiceQuery = invoiceQuery.eq('property_id', propertyId);
      }
      const { data: invoices } = await invoiceQuery;

      // Fetch transactions for payment/refund breakdown
      let txnQuery = supabase
        .from('booking_transactions')
        .select('transaction_type, amount, method, created_at, property_id')
        .gte('created_at', fromDate)
        .lte('created_at', toDate + 'T23:59:59');
      if (propertyId && !showAllProperties) {
        txnQuery = txnQuery.eq('property_id', propertyId);
      }
      const { data: transactions } = await txnQuery;

      // Fetch bookings for source breakdown
      let bookingsQuery = supabase
        .from('bookings')
        .select('booking_source, total_amount, created_at, property_id')
        .gte('created_at', fromDate)
        .lte('created_at', toDate + 'T23:59:59')
        .not('status', 'in', '("cancelled","no_show")');
      if (propertyId && !showAllProperties) {
        bookingsQuery = bookingsQuery.eq('property_id', propertyId);
      }
      const { data: bookings } = await bookingsQuery;

      const totalRevenue = invoices?.reduce((s, i) => s + Number(i.total_amount), 0) || 0;
      const roomRevenue = invoices?.reduce((s, i) => s + Number(i.room_charges), 0) || 0;
      const serviceRevenue = invoices?.reduce((s, i) => s + Number(i.service_charges), 0) || 0;
      const taxCollected = invoices?.reduce((s, i) => s + Number(i.tax_amount), 0) || 0;

      const payments = transactions?.filter(t => t.transaction_type === 'payment') || [];
      const refunds = transactions?.filter(t => t.transaction_type === 'refund') || [];
      const totalPayments = payments.reduce((s, t) => s + Number(t.amount), 0);
      const totalRefunds = refunds.reduce((s, t) => s + Number(t.amount), 0);

      const byMethod: Record<string, number> = {};
      payments.forEach(p => {
        const method = p.method || 'other';
        byMethod[method] = (byMethod[method] || 0) + Number(p.amount);
      });

      const bySource: Record<string, number> = {};
      bookings?.forEach(b => {
        const src = b.booking_source || 'direct';
        bySource[src] = (bySource[src] || 0) + Number(b.total_amount || 0);
      });

      // Daily revenue from invoices
      const dailyMap: Record<string, number> = {};
      const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
      days.forEach(d => { dailyMap[format(d, 'yyyy-MM-dd')] = 0; });
      invoices?.forEach(inv => {
        const day = format(parseISO(inv.created_at), 'yyyy-MM-dd');
        if (dailyMap[day] !== undefined) {
          dailyMap[day] += Number(inv.total_amount);
        }
      });

      const dailyRevenue = Object.entries(dailyMap).map(([date, revenue]) => ({
        date: format(parseISO(date), 'MMM d'),
        revenue,
      }));

      setData({
        totalRevenue,
        roomRevenue,
        serviceRevenue,
        taxCollected,
        totalPayments,
        totalRefunds,
        netCashflow: totalPayments - totalRefunds,
        invoiceCount: invoices?.length || 0,
        byMethod,
        bySource,
        dailyRevenue,
      });
    } catch (err) {
      console.error('Revenue report error:', err);
      toast.error('Failed to load revenue data');
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (!data) return;
    const lines = [
      `Revenue Report - ${propertyName}`,
      `Period: ${format(dateRange.from, 'PP')} - ${format(dateRange.to, 'PP')}`,
      '',
      'Metric,LKR,USD',
      `Total Revenue,${data.totalRevenue},${fxRate ? Math.round(data.totalRevenue / fxRate) : 'N/A'}`,
      `Room Revenue,${data.roomRevenue},${fxRate ? Math.round(data.roomRevenue / fxRate) : 'N/A'}`,
      `Service Revenue,${data.serviceRevenue},${fxRate ? Math.round(data.serviceRevenue / fxRate) : 'N/A'}`,
      `Tax Collected,${data.taxCollected},${fxRate ? Math.round(data.taxCollected / fxRate) : 'N/A'}`,
      `Total Payments Received,${data.totalPayments},${fxRate ? Math.round(data.totalPayments / fxRate) : 'N/A'}`,
      `Total Refunds Issued,${data.totalRefunds},${fxRate ? Math.round(data.totalRefunds / fxRate) : 'N/A'}`,
      `Net Cashflow,${data.netCashflow},${fxRate ? Math.round(data.netCashflow / fxRate) : 'N/A'}`,
      '',
      'Payment Method,Amount (LKR)',
      ...Object.entries(data.byMethod).map(([m, a]) => `${m},${a}`),
      '',
      'Booking Source,Amount (LKR)',
      ...Object.entries(data.bySource).map(([s, a]) => `${s},${a}`),
      '',
      'Date,Revenue (LKR)',
      ...data.dailyRevenue.map(d => `${d.date},${d.revenue}`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Revenue_Report_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Revenue report exported');
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}><CardContent className="pt-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
        <Card><CardContent className="pt-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
      </div>
    );
  }

  if (!data) return null;

  const pieData = Object.entries(data.byMethod).map(([name, value]) => ({
    name: name.replace('_', ' '),
    value,
  }));

  const sourceData = Object.entries(data.bySource).map(([name, value]) => ({
    name: name.replace('_', ' '),
    value,
  }));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Revenue Report</h2>
        <Button variant="outline" onClick={exportCSV} disabled={!data}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard colorVariant="success">
          <div className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-success/10">
                <Wallet className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Revenue</p>
                <CurrencyDisplay amount={data.totalRevenue} fxRate={fxRate} size="md" primaryClassName="font-bold" />
              </div>
            </div>
          </div>
        </KpiCard>
        <KpiCard colorVariant="primary">
          <div className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary/10">
                <BedDouble className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Room Revenue</p>
                <CurrencyDisplay amount={data.roomRevenue} fxRate={fxRate} size="sm" primaryClassName="font-semibold" />
              </div>
            </div>
          </div>
        </KpiCard>
        <KpiCard colorVariant="warning">
          <div className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-warning/10">
                <Sparkles className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Service Revenue</p>
                <CurrencyDisplay amount={data.serviceRevenue} fxRate={fxRate} size="sm" primaryClassName="font-semibold" />
              </div>
            </div>
          </div>
        </KpiCard>
        <KpiCard colorVariant="info">
          <div className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-info/10">
                <Receipt className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Invoices</p>
                <p className="text-lg font-bold">{data.invoiceCount}</p>
              </div>
            </div>
          </div>
        </KpiCard>
      </div>

      {/* Cashflow Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <ArrowDownCircle className="h-5 w-5 text-success" />
              <div>
                <p className="text-xs text-muted-foreground">Payments Received</p>
                <CurrencyDisplay amount={data.totalPayments} fxRate={fxRate} size="sm" primaryClassName="text-success font-semibold" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <ArrowUpCircle className="h-5 w-5 text-destructive" />
              <div>
                <p className="text-xs text-muted-foreground">Refunds Issued</p>
                <CurrencyDisplay amount={data.totalRefunds} fxRate={fxRate} size="sm" primaryClassName="text-destructive font-semibold" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Net Cashflow</p>
                <CurrencyDisplay amount={data.netCashflow} fxRate={fxRate} size="sm" primaryClassName="font-bold" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Revenue Bar Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Daily Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            {data.dailyRevenue.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.dailyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(35, 20%, 82%)" />
                  <XAxis dataKey="date" fontSize={11} tick={{ fill: 'hsl(25, 10%, 45%)' }} />
                  <YAxis fontSize={11} tick={{ fill: 'hsl(25, 10%, 45%)' }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: number) => [`LKR ${value.toLocaleString()}`, 'Revenue']}
                    contentStyle={{ backgroundColor: 'hsl(40, 25%, 98%)', border: '1px solid hsl(35, 20%, 82%)', borderRadius: '8px' }}
                  />
                  <Bar dataKey="revenue" fill="hsl(25, 100%, 8%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-12">No revenue data for this period</p>
            )}
          </CardContent>
        </Card>

        {/* Payment Method Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">By Payment Method</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                    {pieData.map((_, idx) => (
                      <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`LKR ${value.toLocaleString()}`]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-12">No payments recorded</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revenue by Booking Source - Chart + Cards */}
      {sourceData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Revenue by Booking Source</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={sourceData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(35, 20%, 82%)" />
                  <XAxis type="number" fontSize={11} tick={{ fill: 'hsl(25, 10%, 45%)' }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" fontSize={11} tick={{ fill: 'hsl(25, 10%, 45%)' }} width={90} />
                  <Tooltip
                    formatter={(value: number) => [`LKR ${value.toLocaleString()}`, 'Revenue']}
                    contentStyle={{ backgroundColor: 'hsl(40, 25%, 98%)', border: '1px solid hsl(35, 20%, 82%)', borderRadius: '8px' }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {sourceData.map((_, idx) => (
                      <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Source Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={sourceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                    {sourceData.map((_, idx) => (
                      <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`LKR ${value.toLocaleString()}`]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

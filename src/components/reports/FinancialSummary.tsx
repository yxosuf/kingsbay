import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useFxRate } from '@/hooks/useFxRate';
import { format } from 'date-fns';
import { Download, CheckCircle2, AlertTriangle, Scale, BookOpen } from 'lucide-react';
import { toast } from 'sonner';

interface FinancialSummaryProps {
  dateRange: { from: Date; to: Date };
  propertyId: string | null;
  showAllProperties: boolean;
  propertyName: string;
}

interface TrialBalanceRow {
  code: string;
  name: string;
  accountType: string;
  debit: number;
  credit: number;
  balance: number;
}

interface FinancialData {
  trialBalance: TrialBalanceRow[];
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
  imbalancedEntries: number;
  totalEntries: number;
  arBalance: number;
  revenueTotal: number;
  expenseTotal: number;
}

export function FinancialSummary({ dateRange, propertyId, showAllProperties, propertyName }: FinancialSummaryProps) {
  const { fxRate } = useFxRate(propertyId);
  const [data, setData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [dateRange, propertyId, showAllProperties]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const fromDate = format(dateRange.from, 'yyyy-MM-dd');
      const toDate = format(dateRange.to, 'yyyy-MM-dd') + 'T23:59:59';

      // Fetch ledger entries with lines for the period
      let entriesQuery = supabase
        .from('ledger_entries')
        .select('id, created_at, property_id')
        .gte('created_at', fromDate)
        .lte('created_at', toDate);
      if (propertyId && !showAllProperties) {
        entriesQuery = entriesQuery.eq('property_id', propertyId);
      }
      const { data: entries } = await entriesQuery;
      const entryIds = entries?.map(e => e.id) || [];

      // Fetch all lines for these entries
      let allLines: { entry_id: string; account_id: string; debit: number; credit: number }[] = [];
      if (entryIds.length > 0) {
        // Batch fetch in chunks of 100
        for (let i = 0; i < entryIds.length; i += 100) {
          const chunk = entryIds.slice(i, i + 100);
          const { data: lines } = await supabase
            .from('ledger_lines')
            .select('entry_id, account_id, debit, credit')
            .in('entry_id', chunk);
          if (lines) allLines = allLines.concat(lines as any);
        }
      }

      // Fetch accounts
      const { data: accounts } = await supabase
        .from('ledger_accounts')
        .select('id, code, name, account_type')
        .order('code');

      // Build trial balance
      const accountMap = new Map(accounts?.map(a => [a.id, a]) || []);
      const balances: Record<string, { debit: number; credit: number }> = {};

      allLines.forEach(line => {
        const accId = line.account_id;
        if (!balances[accId]) balances[accId] = { debit: 0, credit: 0 };
        balances[accId].debit += Number(line.debit);
        balances[accId].credit += Number(line.credit);
      });

      const trialBalance: TrialBalanceRow[] = [];
      let totalDebits = 0;
      let totalCredits = 0;

      accounts?.forEach(acc => {
        const bal = balances[acc.id];
        if (bal) {
          trialBalance.push({
            code: acc.code,
            name: acc.name,
            accountType: acc.account_type,
            debit: bal.debit,
            credit: bal.credit,
            balance: bal.debit - bal.credit,
          });
          totalDebits += bal.debit;
          totalCredits += bal.credit;
        }
      });

      // Check for imbalanced entries
      const entryBalances: Record<string, number> = {};
      allLines.forEach(line => {
        if (!entryBalances[line.entry_id]) entryBalances[line.entry_id] = 0;
        entryBalances[line.entry_id] += Number(line.debit) - Number(line.credit);
      });
      const imbalancedEntries = Object.values(entryBalances).filter(b => Math.abs(b) > 0.01).length;

      // AR balance
      const arAccount = accounts?.find(a => a.code === '1100');
      const arBalance = arAccount && balances[arAccount.id]
        ? balances[arAccount.id].debit - balances[arAccount.id].credit
        : 0;

      // Revenue & expense totals
      const revenueTotal = trialBalance
        .filter(r => r.accountType === 'revenue')
        .reduce((s, r) => s + r.credit - r.debit, 0);
      const expenseTotal = trialBalance
        .filter(r => r.accountType === 'expense')
        .reduce((s, r) => s + r.debit - r.credit, 0);

      setData({
        trialBalance,
        totalDebits,
        totalCredits,
        isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
        imbalancedEntries,
        totalEntries: entryIds.length,
        arBalance,
        revenueTotal,
        expenseTotal,
      });
    } catch (err) {
      console.error('Financial summary error:', err);
      toast.error('Failed to load financial data');
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (!data) return;
    const lines = [
      `Financial Summary - ${propertyName}`,
      `Period: ${format(dateRange.from, 'PP')} - ${format(dateRange.to, 'PP')}`,
      '',
      'Trial Balance',
      'Code,Account,Type,Debit (LKR),Credit (LKR),Balance (LKR)',
      ...data.trialBalance.map(r => `${r.code},"${r.name}",${r.accountType},${r.debit},${r.credit},${r.balance}`),
      '',
      `Total Debits,${data.totalDebits}`,
      `Total Credits,${data.totalCredits}`,
      `Balanced,${data.isBalanced ? 'Yes' : 'NO - IMBALANCE DETECTED'}`,
      `Imbalanced Entries,${data.imbalancedEntries}`,
      `Total Entries,${data.totalEntries}`,
      '',
      `AR Outstanding,${data.arBalance}`,
      `Total Revenue,${data.revenueTotal}`,
      `Total Expenses,${data.expenseTotal}`,
      `Net Income,${data.revenueTotal - data.expenseTotal}`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Financial_Summary_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Financial summary exported');
  };

  const accountTypeLabel = (type: string) => {
    const colors: Record<string, string> = {
      asset: 'bg-info/10 text-info border-info/30',
      liability: 'bg-warning/10 text-warning border-warning/30',
      equity: 'bg-primary/10 text-primary border-primary/30',
      revenue: 'bg-success/10 text-success border-success/30',
      expense: 'bg-destructive/10 text-destructive border-destructive/30',
    };
    return (
      <Badge variant="outline" className={colors[type] || ''}>
        {type}
      </Badge>
    );
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

  const netIncome = data.revenueTotal - data.expenseTotal;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Financial Summary & Ledger Reconciliation</h2>
        <Button variant="outline" onClick={exportCSV} disabled={!data}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Ledger Health Banner */}
      <Card className={data.isBalanced && data.imbalancedEntries === 0 ? 'border-success/50 bg-success/5' : 'border-destructive/50 bg-destructive/5'}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            {data.isBalanced && data.imbalancedEntries === 0 ? (
              <>
                <CheckCircle2 className="h-6 w-6 text-success" />
                <div>
                  <p className="font-semibold text-success">Ledger Balanced</p>
                  <p className="text-sm text-muted-foreground">
                    All {data.totalEntries} entries balance correctly. Total debits = Total credits = LKR {data.totalDebits.toLocaleString()}
                  </p>
                </div>
              </>
            ) : (
              <>
                <AlertTriangle className="h-6 w-6 text-destructive" />
                <div>
                  <p className="font-semibold text-destructive">Ledger Imbalance Detected</p>
                  <p className="text-sm text-muted-foreground">
                    {data.imbalancedEntries} of {data.totalEntries} entries are imbalanced.
                    Debits: LKR {data.totalDebits.toLocaleString()} | Credits: LKR {data.totalCredits.toLocaleString()}
                  </p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Financial KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard colorVariant="success">
          <div className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-success/10">
                <BookOpen className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Revenue</p>
                <CurrencyDisplay amount={data.revenueTotal} fxRate={fxRate} size="sm" primaryClassName="font-bold text-success" />
              </div>
            </div>
          </div>
        </KpiCard>
        <KpiCard colorVariant="destructive">
          <div className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-destructive/10">
                <BookOpen className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Expenses</p>
                <CurrencyDisplay amount={data.expenseTotal} fxRate={fxRate} size="sm" primaryClassName="font-bold text-destructive" />
              </div>
            </div>
          </div>
        </KpiCard>
        <KpiCard colorVariant="primary">
          <div className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary/10">
                <Scale className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Net Income</p>
                <CurrencyDisplay
                  amount={netIncome}
                  fxRate={fxRate}
                  size="sm"
                  primaryClassName={`font-bold ${netIncome >= 0 ? 'text-success' : 'text-destructive'}`}
                />
              </div>
            </div>
          </div>
        </KpiCard>
        <KpiCard colorVariant="warning">
          <div className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-warning/10">
                <AlertTriangle className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">AR Outstanding</p>
                <CurrencyDisplay
                  amount={data.arBalance}
                  fxRate={fxRate}
                  size="sm"
                  primaryClassName={`font-bold ${data.arBalance > 0 ? 'text-warning' : 'text-success'}`}
                />
              </div>
            </div>
          </div>
        </KpiCard>
      </div>

      {/* Trial Balance Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Trial Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.trialBalance.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Debit (LKR)</TableHead>
                  <TableHead className="text-right">Credit (LKR)</TableHead>
                  <TableHead className="text-right">Balance (LKR)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.trialBalance.map(row => (
                  <TableRow key={row.code}>
                    <TableCell className="font-mono text-sm">{row.code}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{accountTypeLabel(row.accountType)}</TableCell>
                    <TableCell className="text-right font-mono">
                      {row.debit > 0 ? row.debit.toLocaleString() : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {row.credit > 0 ? row.credit.toLocaleString() : '-'}
                    </TableCell>
                    <TableCell className={`text-right font-mono font-semibold ${row.balance > 0 ? '' : row.balance < 0 ? 'text-success' : 'text-muted-foreground'}`}>
                      {row.balance !== 0 ? row.balance.toLocaleString() : '-'}
                    </TableCell>
                  </TableRow>
                ))}
                {/* Totals Row */}
                <TableRow className="border-t-2 font-bold bg-muted/30">
                  <TableCell colSpan={3}>Total</TableCell>
                  <TableCell className="text-right font-mono">{data.totalDebits.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono">{data.totalCredits.toLocaleString()}</TableCell>
                  <TableCell className={`text-right font-mono ${data.isBalanced ? 'text-success' : 'text-destructive'}`}>
                    {data.isBalanced ? '✓ Balanced' : `${(data.totalDebits - data.totalCredits).toLocaleString()}`}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-12">No ledger entries for this period</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

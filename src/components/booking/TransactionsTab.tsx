import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay';
import { RefundDialog } from '@/components/booking/RefundDialog';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ArrowDownCircle, ArrowUpCircle, Receipt, Settings2, Undo2 } from 'lucide-react';

interface Transaction {
  id: string;
  transaction_type: string;
  amount: number;
  currency: string;
  method: string | null;
  notes: string | null;
  created_at: string;
}

interface TransactionsTabProps {
  bookingId: string;
  totalAmount: number;
  fxRate: number | null;
}

export function TransactionsTab({ bookingId, totalAmount, fxRate }: TransactionsTabProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTransactions();

    const channel = supabase
      .channel(`booking-transactions-${bookingId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'booking_transactions',
        filter: `booking_id=eq.${bookingId}`,
      }, () => fetchTransactions())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [bookingId]);

  const fetchTransactions = async () => {
    const { data } = await supabase
      .from('booking_transactions')
      .select('id, transaction_type, amount, currency, method, notes, created_at')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false });
    setTransactions((data as Transaction[]) || []);
    setLoading(false);
  };

  const totalPayments = transactions
    .filter(t => t.transaction_type === 'payment')
    .reduce((s, t) => s + Number(t.amount), 0);

  const totalRefunds = transactions
    .filter(t => t.transaction_type === 'refund')
    .reduce((s, t) => s + Number(t.amount), 0);

  const outstanding = totalAmount - totalPayments + totalRefunds;

  const typeIcon = (type: string) => {
    switch (type) {
      case 'payment': return <ArrowDownCircle className="h-4 w-4 text-emerald-500" />;
      case 'refund': return <ArrowUpCircle className="h-4 w-4 text-destructive" />;
      case 'commission': return <Receipt className="h-4 w-4 text-amber-500" />;
      default: return <Settings2 className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const typeBadge = (type: string) => {
    const variants: Record<string, string> = {
      payment: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
      refund: 'bg-destructive/10 text-destructive border-destructive/30',
      commission: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
      adjustment: 'bg-muted text-muted-foreground border-muted-foreground/30',
    };
    return (
      <Badge variant="outline" className={variants[type] || ''}>
        {type}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle>Transactions</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3 p-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Transactions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Balance Summary */}
        <div className="grid grid-cols-3 gap-3 p-3 bg-muted rounded-lg">
          <div>
            <p className="text-xs text-muted-foreground">Total Due</p>
            <CurrencyDisplay amount={totalAmount} fxRate={fxRate} size="sm" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Paid</p>
            <CurrencyDisplay amount={totalPayments} fxRate={fxRate} size="sm" primaryClassName="text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Outstanding</p>
            <CurrencyDisplay
              amount={Math.max(0, outstanding)}
              fxRate={fxRate}
              size="sm"
              primaryClassName={outstanding > 0 ? 'text-destructive font-semibold' : 'text-emerald-600'}
            />
          </div>
        </div>

        {/* Transaction List */}
        {transactions.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">
            No transactions recorded yet
          </p>
        ) : (
          <div className="space-y-1">
            {transactions.map((tx, idx) => (
              <div key={tx.id}>
                <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="mt-0.5">{typeIcon(tx.transaction_type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {typeBadge(tx.transaction_type)}
                      {tx.method && (
                        <span className="text-xs text-muted-foreground capitalize">
                          {tx.method.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                    {tx.notes && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">{tx.notes}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {format(new Date(tx.created_at), 'PPp')}
                    </p>
                  </div>
                  <CurrencyDisplay
                    amount={Number(tx.amount)}
                    fxRate={fxRate}
                    size="sm"
                    primaryClassName={tx.transaction_type === 'refund' ? 'text-destructive' : 'font-medium'}
                  />
                </div>
                {idx < transactions.length - 1 && <Separator className="mx-3" />}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

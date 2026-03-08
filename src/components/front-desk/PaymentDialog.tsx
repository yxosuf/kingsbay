import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay';
import { supabase } from '@/integrations/supabase/client';
import { useProperty } from '@/hooks/useProperty';
import { useFxRate } from '@/hooks/useFxRate';
import { useAuth } from '@/hooks/useAuth';
import { postPayment } from '@/lib/ledgerUtils';
import { toast } from 'sonner';

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: {
    id: string;
    guests: { name: string } | null;
    rooms: { room_number: string } | null;
    invoices: { id: string; total_amount: number; payment_status: string }[];
  };
  onSuccess: () => void;
}

export function PaymentDialog({ open, onOpenChange, booking, onSuccess }: PaymentDialogProps) {
  const { selectedProperty } = useProperty();
  const { fxRate } = useFxRate(selectedProperty?.id);
  const { user } = useAuth();

  const unpaidInvoices = booking.invoices?.filter((inv) => inv.payment_status !== 'paid') || [];
  const totalUnpaid = unpaidInvoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0);

  const [amount, setAmount] = useState(totalUnpaid > 0 ? totalUnpaid.toString() : '');
  const [method, setMethod] = useState<string>('cash');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    const payAmount = parseFloat(amount);
    if (isNaN(payAmount) || payAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (unpaidInvoices.length === 0) {
      toast.error('No unpaid invoices found');
      return;
    }

    setSaving(true);
    try {
      const invoice = unpaidInvoices[0];

      // 1. Insert payment record
      const { error: payErr } = await supabase.from('payments').insert({
        invoice_id: invoice.id,
        amount: payAmount,
        method: method as any,
        notes: notes.trim() || null,
        property_id: selectedProperty?.id || null,
        received_by: user?.id || null,
      });
      if (payErr) throw payErr;

      // 2. Create booking transaction
      const { data: txn, error: txnErr } = await supabase
        .from('booking_transactions')
        .insert({
          booking_id: booking.id,
          transaction_type: 'payment' as any,
          amount: payAmount,
          currency: 'LKR',
          method: method as any,
          notes: notes.trim() || null,
          created_by: user?.id || null,
          property_id: selectedProperty?.id || null,
        })
        .select('id')
        .single();
      if (txnErr) throw txnErr;

      // 3. Post ledger entry
      if (txn && selectedProperty?.id) {
        await postPayment(txn.id, payAmount, method, selectedProperty.id, booking.id, user?.id);
      }

      // 4. Update invoice payment status
      const { data: existingPayments } = await supabase
        .from('payments')
        .select('amount')
        .eq('invoice_id', invoice.id);

      const totalPaid = (existingPayments || []).reduce(
        (sum, p) => sum + Number(p.amount),
        0
      );

      const newStatus = totalPaid >= Number(invoice.total_amount) ? 'paid' : 'partial';

      await supabase
        .from('invoices')
        .update({ payment_status: newStatus })
        .eq('id', invoice.id);

      toast.success(`Payment of LKR ${payAmount.toLocaleString()} recorded`);
      setAmount('');
      setNotes('');
      onSuccess();
      onOpenChange(false);
    } catch {
      toast.error('Failed to record payment. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            Record a payment for {booking.guests?.name || 'guest'} — Room {booking.rooms?.room_number}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Outstanding Balance</p>
            <CurrencyDisplay
              amount={totalUnpaid}
              fxRate={fxRate}
              size="lg"
              primaryClassName="text-destructive"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {unpaidInvoices.length} unpaid invoice{unpaidInvoices.length > 1 ? 's' : ''}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Amount (LKR)</label>
            <Input
              type="number"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min={0}
            />
            {amount && fxRate && parseFloat(amount) > 0 && (
              <p className="text-xs text-muted-foreground">
                ~${Math.round(parseFloat(amount) / fxRate).toLocaleString()} USD
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Payment Method</label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="online">Online</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Notes (optional)</label>
            <Textarea
              placeholder="Payment notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || !amount}>
            {saving ? 'Recording...' : 'Record Payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

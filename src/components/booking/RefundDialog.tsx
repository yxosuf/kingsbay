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
import { useAuth } from '@/hooks/useAuth';
import { postRefund } from '@/lib/ledgerUtils';
import { toast } from 'sonner';

interface RefundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  propertyId: string | null;
  maxRefundable: number;
  fxRate: number | null;
  onSuccess: () => void;
}

export function RefundDialog({
  open,
  onOpenChange,
  bookingId,
  propertyId,
  maxRefundable,
  fxRate,
  onSuccess,
}: RefundDialogProps) {
  const { user } = useAuth();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    const refundAmount = parseFloat(amount);
    if (isNaN(refundAmount) || refundAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (refundAmount > maxRefundable) {
      toast.error(`Refund cannot exceed LKR ${maxRefundable.toLocaleString()}`);
      return;
    }
    if (!reason.trim()) {
      toast.error('Please provide a reason for the refund');
      return;
    }

    setSaving(true);
    try {
      // 1. Create refund transaction
      const { data: txn, error: txnErr } = await supabase
        .from('booking_transactions')
        .insert({
          booking_id: bookingId,
          transaction_type: 'refund' as any,
          amount: refundAmount,
          currency: 'LKR',
          method: method as any,
          notes: reason.trim(),
          created_by: user?.id || null,
          property_id: propertyId,
        })
        .select('id')
        .single();

      if (txnErr) throw txnErr;

      // 2. Post reverse ledger entry (DR: AR, CR: Cash/Bank/Card)
      if (txn && propertyId) {
        await postRefund(txn.id, refundAmount, method, propertyId, bookingId, user?.id);
      }

      toast.success(`Refund of LKR ${refundAmount.toLocaleString()} processed`);
      setAmount('');
      setReason('');
      onSuccess();
      onOpenChange(false);
    } catch {
      toast.error('Failed to process refund. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Process Refund</DialogTitle>
          <DialogDescription>
            Issue a refund for this booking. This will reverse the corresponding ledger entries.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Maximum Refundable</p>
            <CurrencyDisplay
              amount={maxRefundable}
              fxRate={fxRate}
              size="lg"
              primaryClassName="text-emerald-600"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Refund Amount (LKR)</label>
            <Input
              type="number"
              placeholder="Enter refund amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min={0}
              max={maxRefundable}
            />
            {amount && fxRate && parseFloat(amount) > 0 && (
              <p className="text-xs text-muted-foreground">
                ~${Math.round(parseFloat(amount) / fxRate).toLocaleString()} USD
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Refund Method</label>
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
            <label className="text-sm font-medium">Reason for Refund *</label>
            <Textarea
              placeholder="Explain the reason for this refund..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={saving || !amount || !reason.trim()}
          >
            {saving ? 'Processing...' : 'Process Refund'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

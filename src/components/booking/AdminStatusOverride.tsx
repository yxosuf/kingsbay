import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const OVERRIDABLE_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'checked_in', label: 'Checked In' },
  { value: 'checked_out', label: 'Checked Out' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show', label: 'No Show' },
  { value: 'needs_review', label: 'Needs Review' },
];

interface AdminStatusOverrideProps {
  bookingId: string;
  currentStatus: string;
  onSuccess: () => void;
}

export function AdminStatusOverride({ bookingId, currentStatus, onSuccess }: AdminStatusOverrideProps) {
  const [open, setOpen] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [auditNote, setAuditNote] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleOverride = async () => {
    if (!newStatus || !auditNote.trim()) {
      toast.error('Please select a status and provide an audit note');
      return;
    }

    setProcessing(true);
    try {
      const updateData: Record<string, any> = {
        status: newStatus,
        special_requests: auditNote.trim(), // Using special_requests to store audit note for now
      };

      // Set corresponding timestamps
      if (newStatus === 'checked_in') updateData.checked_in_at = new Date().toISOString();
      if (newStatus === 'checked_out') updateData.checked_out_at = new Date().toISOString();
      if (newStatus === 'cancelled') updateData.cancelled_at = new Date().toISOString();
      if (newStatus === 'no_show') updateData.no_show_at = new Date().toISOString();

      const { error } = await supabase
        .from('bookings')
        .update(updateData)
        .eq('id', bookingId);

      if (error) throw error;

      toast.success(`Status overridden to "${newStatus.replace('_', ' ')}"`);
      setOpen(false);
      setNewStatus('');
      setAuditNote('');
      onSuccess();
    } catch {
      toast.error('Failed to override status');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="text-warning border-warning">
        <Shield className="h-4 w-4 mr-1" />
        Override Status
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-warning" />
              Admin Status Override
            </DialogTitle>
            <DialogDescription>
              Manually change the booking status. An audit note is required.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Current Status: <strong className="capitalize">{currentStatus.replace('_', ' ')}</strong></p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">New Status</label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select new status..." />
                </SelectTrigger>
                <SelectContent>
                  {OVERRIDABLE_STATUSES.filter((s) => s.value !== currentStatus).map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Audit Note (required)</label>
              <Textarea
                placeholder="Reason for status override..."
                value={auditNote}
                onChange={(e) => setAuditNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleOverride} disabled={processing || !newStatus || !auditNote.trim()}>
              {processing ? 'Updating...' : 'Confirm Override'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

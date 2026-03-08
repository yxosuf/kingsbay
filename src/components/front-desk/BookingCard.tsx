import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
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
  Eye,
  LogIn,
  LogOut,
  X,
  UserX,
  CalendarPlus,
  ArrowRightLeft,
  Banknote,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { MoveRoomDialog } from './MoveRoomDialog';
import { PaymentDialog } from './PaymentDialog';

interface FrontDeskBooking {
  id: string;
  check_in: string;
  check_out: string;
  status: string;
  num_guests: number | null;
  total_amount: number | null;
  room_id: string;
  property_id: string | null;
  booking_source: string;
  guests: { name: string; phone: string | null } | null;
  rooms: { room_number: string; room_type: string } | null;
  invoices?: { id: string; total_amount: number; payment_status: string }[];
}

interface BookingCardProps {
  booking: FrontDeskBooking;
  onActionComplete: () => void;
  badge?: React.ReactNode;
}

export function BookingCard({ booking, onActionComplete, badge }: BookingCardProps) {
  const navigate = useNavigate();
  const { canWrite } = useAuth();
  const [cancelDialog, setCancelDialog] = useState(false);
  const [noShowDialog, setNoShowDialog] = useState(false);
  const [moveRoomOpen, setMoveRoomOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const isArrival = booking.status === 'confirmed' || booking.status === 'pending';
  const isInHouse = booking.status === 'checked_in';
  const hasUnpaidInvoice = booking.invoices?.some((inv) => inv.payment_status !== 'paid');

  const handleCheckIn = async () => {
    setProcessing(true);
    try {
      const { error: bookingErr } = await supabase
        .from('bookings')
        .update({ status: 'checked_in', checked_in_at: new Date().toISOString() })
        .eq('id', booking.id);
      if (bookingErr) throw bookingErr;

      await supabase
        .from('rooms')
        .update({ status: 'occupied' })
        .eq('id', booking.room_id);

      toast.success('Guest checked in successfully');
      onActionComplete();
    } catch {
      toast.error('Failed to check in guest');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      toast.error('Please provide a cancellation reason');
      return;
    }
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('bookings')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancel_reason: cancelReason.trim(),
        })
        .eq('id', booking.id);
      if (error) throw error;

      toast.success('Booking cancelled');
      setCancelDialog(false);
      setCancelReason('');
      onActionComplete();
    } catch {
      toast.error('Failed to cancel booking');
    } finally {
      setProcessing(false);
    }
  };

  const handleNoShow = async () => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'no_show', no_show_at: new Date().toISOString() })
        .eq('id', booking.id);
      if (error) throw error;

      toast.success('Booking marked as no-show');
      setNoShowDialog(false);
      onActionComplete();
    } catch {
      toast.error('Failed to mark as no-show');
    } finally {
      setProcessing(false);
    }
  };

  const handleCheckOut = async () => {
    setProcessing(true);
    try {
      const { error: bookingErr } = await supabase
        .from('bookings')
        .update({ status: 'checked_out', checked_out_at: new Date().toISOString() })
        .eq('id', booking.id);
      if (bookingErr) throw bookingErr;

      // Set room to cleaning
      await supabase
        .from('rooms')
        .update({
          status: 'available',
          housekeeping_status: 'dirty',
          last_checkout_at: new Date().toISOString(),
          cleaning_until: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
        })
        .eq('id', booking.room_id);

      toast.success('Guest checked out successfully');
      onActionComplete();
    } catch {
      toast.error('Failed to check out guest');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-2 rounded-xl border p-3 hover:bg-muted/30 transition-colors">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium truncate">
                {booking.guests?.name || 'Unknown Guest'}
              </p>
              {badge}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Room {booking.rooms?.room_number || '—'} · {booking.rooms?.room_type || ''}
              {booking.num_guests
                ? ` · ${(booking as any).num_adults || booking.num_guests}A${(booking as any).num_children ? ` + ${(booking as any).num_children}C` : ''}`
                : ''}
            </p>
            {booking.guests?.phone && (
              <p className="text-xs text-muted-foreground">{booking.guests.phone}</p>
            )}
          </div>
          {booking.total_amount != null && (
            <p className="text-xs font-medium shrink-0">
              LKR {Number(booking.total_amount).toLocaleString()}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 flex-wrap">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/bookings/${booking.id}`)}>
            <Eye className="h-4 w-4" />
          </Button>

          {isArrival && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="text-emerald-600 h-7 text-xs"
                onClick={handleCheckIn}
                disabled={!canWrite || processing}
              >
                <LogIn className="h-3.5 w-3.5 mr-1" />
                Check In
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive h-7 text-xs"
                onClick={() => setCancelDialog(true)}
                disabled={!canWrite || processing}
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Cancel
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground h-7 text-xs"
                onClick={() => setNoShowDialog(true)}
                disabled={!canWrite || processing}
              >
                <UserX className="h-3.5 w-3.5 mr-1" />
                No Show
              </Button>
            </>
          )}

          {isInHouse && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="text-blue-600 h-7 text-xs"
                onClick={() => navigate(`/bookings/${booking.id}`)}
                disabled={!canWrite}
              >
                <CalendarPlus className="h-3.5 w-3.5 mr-1" />
                Extend
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-violet-600 h-7 text-xs"
                onClick={() => setMoveRoomOpen(true)}
                disabled={!canWrite}
              >
                <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />
                Move
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-amber-600 h-7 text-xs"
                onClick={handleCheckOut}
                disabled={!canWrite || processing}
              >
                <LogOut className="h-3.5 w-3.5 mr-1" />
                Check Out
              </Button>
            </>
          )}

          {canWrite && hasUnpaidInvoice && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive h-7 text-xs"
              onClick={() => setPaymentOpen(true)}
            >
              <Banknote className="h-3.5 w-3.5 mr-1" />
              Pay
            </Button>
          )}
        </div>
      </div>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialog} onOpenChange={setCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Booking</DialogTitle>
            <DialogDescription>
              This cannot be undone. Provide a reason for cancellation.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="text-sm space-y-1">
              <p><strong>Guest:</strong> {booking.guests?.name || 'Unknown'}</p>
              <p><strong>Room:</strong> {booking.rooms?.room_number || '—'}</p>
            </div>
            <Textarea
              placeholder="Reason for cancellation..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCancelDialog(false); setCancelReason(''); }}>
              Keep Booking
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={processing || !cancelReason.trim()}>
              {processing ? 'Cancelling...' : 'Cancel Booking'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* No-Show Dialog */}
      <Dialog open={noShowDialog} onOpenChange={setNoShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as No-Show</DialogTitle>
            <DialogDescription>
              This will release the room. Are you sure?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 text-sm space-y-1">
            <p><strong>Guest:</strong> {booking.guests?.name || 'Unknown'}</p>
            <p><strong>Room:</strong> {booking.rooms?.room_number || '—'}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoShowDialog(false)}>Go Back</Button>
            <Button variant="destructive" onClick={handleNoShow} disabled={processing}>
              {processing ? 'Processing...' : 'Confirm No-Show'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Room Dialog */}
      <MoveRoomDialog
        open={moveRoomOpen}
        onOpenChange={setMoveRoomOpen}
        booking={booking}
        onSuccess={onActionComplete}
      />

      {/* Quick Payment Dialog */}
      {booking.invoices && booking.invoices.length > 0 && (
        <PaymentDialog
          open={paymentOpen}
          onOpenChange={setPaymentOpen}
          booking={{
            id: booking.id,
            guests: booking.guests ? { name: booking.guests.name } : null,
            rooms: booking.rooms ? { room_number: booking.rooms.room_number } : null,
            invoices: booking.invoices,
          }}
          onSuccess={onActionComplete}
        />
      )}
    </>
  );
}

export type { FrontDeskBooking };

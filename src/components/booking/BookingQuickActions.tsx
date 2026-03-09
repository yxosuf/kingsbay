import { useState } from 'react';
import { QRCodeDisplay } from './QRCodeDisplay';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
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
import { Eye, LogIn, LogOut, X, UserX } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { sendGuestEmail } from '@/lib/guestEmail';

interface Booking {
  id: string;
  status: string;
  room_id: string;
  guests: { name: string } | null;
  rooms: { room_number: string } | null;
  check_in: string;
  check_out: string;
}

interface BookingQuickActionsProps {
  booking: Booking;
  onActionComplete: () => void;
  compact?: boolean;
}

type ActionDialog = 
  | { type: 'cancel'; booking: Booking }
  | { type: 'no_show'; booking: Booking }
  | { type: 'checkout'; booking: Booking }
  | null;

export function BookingQuickActions({ booking, onActionComplete, compact = false }: BookingQuickActionsProps) {
  const navigate = useNavigate();
  const { canWrite } = useAuth();
  const [actionDialog, setActionDialog] = useState<ActionDialog>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleCheckIn = async () => {
    try {
      const { error: bookingError } = await supabase
        .from('bookings')
        .update({ status: 'checked_in', checked_in_at: new Date().toISOString() })
        .eq('id', booking.id);
      if (bookingError) throw bookingError;

      const { error: roomError } = await supabase
        .from('rooms')
        .update({ status: 'occupied' })
        .eq('id', booking.room_id);
      if (roomError) throw roomError;

      toast.success('Guest checked in successfully');
      // Send confirmation email (fire-and-forget)
      sendGuestEmail(booking.id, 'booking_confirmation').catch(() => {});
      onActionComplete();
    } catch {
      toast.error('Failed to check in guest');
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
      setActionDialog(null);
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
        .update({
          status: 'no_show',
          no_show_at: new Date().toISOString(),
        })
        .eq('id', booking.id);
      if (error) throw error;

      toast.success('Booking marked as no-show');
      setActionDialog(null);
      onActionComplete();
    } catch {
      toast.error('Failed to mark as no-show');
    } finally {
      setProcessing(false);
    }
  };

  const handleCheckoutNavigate = () => {
    navigate(`/bookings/${booking.id}/checkout`);
  };

  const canCheckIn = canWrite && (booking.status === 'pending' || booking.status === 'confirmed');
  const canCheckOut = canWrite && booking.status === 'checked_in';
  const canCancel = canWrite && (booking.status === 'pending' || booking.status === 'confirmed' || booking.status === 'needs_review');
  const canNoShow = canWrite && (booking.status === 'confirmed' || booking.status === 'pending');

  const size = compact ? 'icon' as const : 'sm' as const;
  const variant = compact ? 'ghost' as const : 'outline' as const;

  return (
    <>
      <div className="flex items-center gap-1">
        <Button variant={variant} size={size} onClick={() => navigate(`/bookings/${booking.id}`)}>
          <Eye className="h-4 w-4" />
          {!compact && <span className="ml-1">View</span>}
        </Button>

        {canCheckIn && (
          <Button
            variant={variant}
            size={size}
            className="text-success"
            onClick={handleCheckIn}
          >
            <LogIn className="h-4 w-4" />
            {!compact && <span className="ml-1">Check In</span>}
          </Button>
        )}

        {canCheckOut && (
          <Button
            variant={variant}
            size={size}
            className="text-warning"
            onClick={handleCheckoutNavigate}
          >
            <LogOut className="h-4 w-4" />
            {!compact && <span className="ml-1">Check Out</span>}
          </Button>
        )}

        {canNoShow && (
          <Button
            variant={variant}
            size={size}
            className="text-muted-foreground"
            onClick={() => setActionDialog({ type: 'no_show', booking })}
          >
            <UserX className="h-4 w-4" />
            {!compact && <span className="ml-1">No Show</span>}
          </Button>
        )}

        {canCancel && (
          <Button
            variant={variant}
            size={size}
            className="text-destructive"
            onClick={() => setActionDialog({ type: 'cancel', booking })}
          >
            <X className="h-4 w-4" />
            {!compact && <span className="ml-1">Cancel</span>}
          </Button>
        )}
      </div>

      {/* Cancel Dialog */}
      <Dialog
        open={actionDialog?.type === 'cancel'}
        onOpenChange={(open) => !open && setActionDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Booking</DialogTitle>
            <DialogDescription>
              This action cannot be undone. Please provide a reason for cancellation.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2 text-sm">
              <p><strong>Guest:</strong> {booking.guests?.name || 'Unknown'}</p>
              <p><strong>Room:</strong> {booking.rooms?.room_number || 'N/A'}</p>
              <p><strong>Dates:</strong> {new Date(booking.check_in).toLocaleDateString()} – {new Date(booking.check_out).toLocaleDateString()}</p>
            </div>
            <Textarea
              placeholder="Reason for cancellation..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setActionDialog(null); setCancelReason(''); }}>
              Keep Booking
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={processing || !cancelReason.trim()}>
              {processing ? 'Cancelling...' : 'Cancel Booking'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* No-Show Dialog */}
      <Dialog
        open={actionDialog?.type === 'no_show'}
        onOpenChange={(open) => !open && setActionDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as No-Show</DialogTitle>
            <DialogDescription>
              Are you sure you want to mark this booking as a no-show? This will release the room.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2 text-sm">
            <p><strong>Guest:</strong> {booking.guests?.name || 'Unknown'}</p>
            <p><strong>Room:</strong> {booking.rooms?.room_number || 'N/A'}</p>
            <p><strong>Expected Check-in:</strong> {new Date(booking.check_in).toLocaleDateString()}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>
              Go Back
            </Button>
            <Button variant="destructive" onClick={handleNoShow} disabled={processing}>
              {processing ? 'Processing...' : 'Confirm No-Show'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

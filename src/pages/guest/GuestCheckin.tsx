import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SignaturePad } from '@/components/booking/SignaturePad';
import { CheckCircle, Loader2, AlertTriangle, Hotel } from 'lucide-react';

export default function GuestCheckin() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    id_passport: '',
    address: '',
    signature: '',
  });
  const [submitted, setSubmitted] = useState(false);

  // Fetch booking info (public — no auth required)
  const { data: booking, isLoading, error } = useQuery({
    queryKey: ['guest-checkin', bookingId],
    queryFn: async () => {
      if (!bookingId) throw new Error('No booking ID');
      const { data, error } = await supabase
        .from('bookings')
        .select('id, status, check_in, check_out, guest_id, rooms (room_number), guests (name, email, phone)')
        .eq('id', bookingId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Booking not found');
      return data;
    },
    enabled: !!bookingId,
  });

  // Pre-fill from existing guest data
  const guestData = booking?.guests as any;
  const prefilled = {
    name: form.name || guestData?.name || '',
    email: form.email || guestData?.email || '',
    phone: form.phone || guestData?.phone || '',
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!bookingId || !booking) throw new Error('No booking');

      // Update guest profile
      const { error: guestError } = await supabase
        .from('guests')
        .update({
          name: form.name || prefilled.name,
          phone: form.phone || prefilled.phone,
          email: form.email || prefilled.email,
          id_passport: form.id_passport || null,
          address: form.address || null,
        })
        .eq('id', booking.guest_id);

      if (guestError) throw guestError;

      // Update booking to checked_in
      const { error: bookingError } = await supabase
        .from('bookings')
        .update({
          status: 'checked_in' as any,
          checked_in_at: new Date().toISOString(),
        })
        .eq('id', bookingId);

      if (bookingError) throw bookingError;
    },
    onSuccess: () => {
      setSubmitted(true);
      toast.success('Check-in complete!');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Check-in failed');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nameVal = form.name || prefilled.name;
    if (!nameVal.trim()) {
      toast.error('Please enter your name');
      return;
    }
    if (!form.signature) {
      toast.error('Please provide your signature');
      return;
    }
    submitMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-sm w-full">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 text-warning mx-auto mb-3" />
            <h2 className="text-lg font-semibold">Booking Not Found</h2>
            <p className="text-sm text-muted-foreground mt-2">
              This check-in link may have expired or is invalid.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const alreadyCheckedIn = booking.status === 'checked_in' || booking.status === 'checked_out';
  const roomNumber = (booking.rooms as any)?.room_number;

  if (submitted || alreadyCheckedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-sm w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-16 w-16 text-success mx-auto mb-4" />
            <h2 className="text-xl font-bold">Check-In Complete!</h2>
            {roomNumber && (
              <p className="text-lg text-muted-foreground mt-2">
                Your room: <span className="font-bold text-foreground">{roomNumber}</span>
              </p>
            )}
            <p className="text-sm text-muted-foreground mt-4">
              Welcome! Please proceed to the front desk if you need assistance.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-lg mx-auto space-y-4">
        {/* Header */}
        <div className="text-center pt-4 pb-2">
          <div className="inline-flex items-center gap-2 text-primary mb-2">
            <Hotel className="h-6 w-6" />
            <span className="text-lg font-bold">Self Check-In</span>
          </div>
          {roomNumber && (
            <p className="text-sm text-muted-foreground">Room {roomNumber}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            {booking.check_in} → {booking.check_out}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={form.name || prefilled.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Enter your full name"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={form.phone || prefilled.phone}
                    onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+94 77 123 4567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email || prefilled.email}
                    onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="guest@email.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="id_passport">Passport / NIC Number</Label>
                <Input
                  id="id_passport"
                  value={form.id_passport}
                  onChange={(e) => setForm(f => ({ ...f, id_passport: e.target.value }))}
                  placeholder="Passport or NIC number"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={form.address}
                  onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))}
                  placeholder="Your address"
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Signature *</Label>
                <SignaturePad onSignature={(sig) => setForm(f => ({ ...f, signature: sig }))} />
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={submitMutation.isPending}
              >
                {submitMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Complete Check-In
              </Button>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  );
}

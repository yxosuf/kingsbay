-- Add onboarding_completed to user_settings
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- Create guest_communications table
CREATE TABLE public.guest_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  comm_type text NOT NULL DEFAULT 'email',
  subject text,
  body text,
  recipient_email text,
  sent_by uuid,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.guest_communications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view guest communications"
ON public.guest_communications FOR SELECT
TO authenticated
USING (public.is_staff());

CREATE POLICY "Write staff can insert guest communications"
ON public.guest_communications FOR INSERT
TO authenticated
WITH CHECK (public.is_write_staff());

CREATE POLICY "Admin can delete guest communications"
ON public.guest_communications FOR DELETE
TO authenticated
USING (public.is_admin());

CREATE INDEX idx_guest_comms_guest_id ON public.guest_communications(guest_id);
CREATE INDEX idx_guest_comms_booking_id ON public.guest_communications(booking_id);
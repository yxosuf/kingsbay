
-- =============================================
-- 1. BOOKING LIFECYCLE: Add new statuses
-- =============================================
ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'no_show';
ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'needs_review';

-- Add timestamp columns for booking lifecycle events
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS checked_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS checked_out_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS no_show_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS hold_expires_at timestamptz;

-- =============================================
-- 2. ROOM OPERATIONAL STATUS
-- =============================================
DO $$ BEGIN
  CREATE TYPE public.housekeeping_status AS ENUM ('clean', 'dirty', 'cleaning');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS housekeeping_status public.housekeeping_status NOT NULL DEFAULT 'clean',
  ADD COLUMN IF NOT EXISTS last_checkout_at timestamptz;

-- =============================================
-- 3. GUEST MANAGEMENT: New fields
-- =============================================
DO $$ BEGIN
  CREATE TYPE public.guest_type AS ENUM ('local', 'international');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS guest_type public.guest_type NOT NULL DEFAULT 'local',
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'Sri Lanka',
  ADD COLUMN IF NOT EXISTS passport_number text,
  ADD COLUMN IF NOT EXISTS nic_number text,
  ADD COLUMN IF NOT EXISTS is_vip boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_blacklisted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS blacklist_reason text,
  ADD COLUMN IF NOT EXISTS total_stays integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_spent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS passport_photo_path text,
  ADD COLUMN IF NOT EXISTS passport_photo_uploaded_at timestamptz;

-- =============================================
-- 4. HOLD TIMEOUT
-- =============================================
ALTER TABLE public.property_inventory_settings
  ADD COLUMN IF NOT EXISTS hold_timeout_hours integer NOT NULL DEFAULT 4;

-- =============================================
-- 5. GUEST VIEW AUDIT LOG
-- =============================================
CREATE TABLE IF NOT EXISTS public.guest_view_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  property_id uuid REFERENCES public.properties(id)
);

ALTER TABLE public.guest_view_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Manager can view guest view logs"
  ON public.guest_view_logs FOR SELECT
  USING (is_admin() OR is_manager());

CREATE POLICY "Staff can insert guest view logs"
  ON public.guest_view_logs FOR INSERT
  WITH CHECK (is_staff() AND auth.uid() = user_id);

-- =============================================
-- 6. PASSPORT PHOTO STORAGE BUCKET (PRIVATE)
-- =============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('guest-documents', 'guest-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Staff can upload guest documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'guest-documents' AND is_staff());

CREATE POLICY "Staff can view guest documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'guest-documents' AND is_staff());

CREATE POLICY "Admin can delete guest documents"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'guest-documents' AND is_admin());

CREATE POLICY "Staff can update guest documents"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'guest-documents' AND is_staff());

-- =============================================
-- 7. INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_guest_view_logs_guest_id ON public.guest_view_logs(guest_id);
CREATE INDEX IF NOT EXISTS idx_guest_view_logs_user_id ON public.guest_view_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_guests_guest_type ON public.guests(guest_type);
CREATE INDEX IF NOT EXISTS idx_guests_is_vip ON public.guests(is_vip) WHERE is_vip = true;
CREATE INDEX IF NOT EXISTS idx_guests_is_blacklisted ON public.guests(is_blacklisted) WHERE is_blacklisted = true;
CREATE INDEX IF NOT EXISTS idx_bookings_hold_expires_at ON public.bookings(hold_expires_at) WHERE hold_expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rooms_housekeeping ON public.rooms(housekeeping_status);

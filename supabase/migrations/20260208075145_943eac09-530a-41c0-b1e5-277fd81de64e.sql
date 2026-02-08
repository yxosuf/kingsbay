-- Add external booking fields to bookings table
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS imported_via TEXT,
  ADD COLUMN IF NOT EXISTS raw_email_id TEXT;

-- Add unique constraint for external bookings (external_source and external_booking_id already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookings_external_source_booking_id_unique'
  ) THEN
    ALTER TABLE public.bookings 
      ADD CONSTRAINT bookings_external_source_booking_id_unique 
      UNIQUE (external_source, external_booking_id);
  END IF;
END $$;

-- Create email_ingest_logs table
CREATE TABLE IF NOT EXISTS public.email_ingest_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  message_id TEXT,
  subject TEXT,
  from_email TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  parse_status TEXT NOT NULL DEFAULT 'pending',
  parse_error TEXT,
  extracted JSONB,
  raw_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add index for quick lookups
CREATE INDEX IF NOT EXISTS idx_email_ingest_logs_property ON public.email_ingest_logs(property_id);
CREATE INDEX IF NOT EXISTS idx_email_ingest_logs_status ON public.email_ingest_logs(parse_status);
CREATE INDEX IF NOT EXISTS idx_email_ingest_logs_received ON public.email_ingest_logs(received_at DESC);

-- Enable RLS
ALTER TABLE public.email_ingest_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for email_ingest_logs
CREATE POLICY "Staff can view email logs for accessible properties"
  ON public.email_ingest_logs
  FOR SELECT
  USING (public.is_staff());

CREATE POLICY "Staff can insert email logs"
  ON public.email_ingest_logs
  FOR INSERT
  WITH CHECK (public.is_staff());

CREATE POLICY "Staff can update email logs"
  ON public.email_ingest_logs
  FOR UPDATE
  USING (public.is_staff());
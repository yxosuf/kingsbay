-- Add unique constraint for external bookings if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'bookings_external_source_booking_id_key'
  ) THEN
    ALTER TABLE public.bookings
    ADD CONSTRAINT bookings_external_source_booking_id_key 
    UNIQUE (external_source, external_booking_id);
  END IF;
END $$;
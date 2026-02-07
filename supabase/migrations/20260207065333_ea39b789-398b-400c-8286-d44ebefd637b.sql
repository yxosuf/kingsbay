-- Add parent_booking_id for split bookings (extend stay with room move)
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS parent_booking_id uuid REFERENCES public.bookings(id);

-- Add index for parent booking lookups
CREATE INDEX IF NOT EXISTS idx_bookings_parent ON public.bookings(parent_booking_id) WHERE parent_booking_id IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN public.bookings.parent_booking_id IS 'Links continuation bookings when guest extends stay but needs to move rooms';
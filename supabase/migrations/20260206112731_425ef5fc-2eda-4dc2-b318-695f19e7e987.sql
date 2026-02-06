-- =====================================================
-- PRODUCTION SAFETY UPGRADE: Database Schema Changes
-- =====================================================

-- 1. Add external booking identification columns for idempotent OTA ingestion
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS external_booking_id TEXT,
ADD COLUMN IF NOT EXISTS external_source TEXT,
ADD COLUMN IF NOT EXISTS external_room_type_id TEXT,
ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS review_reason TEXT;

-- Create unique constraint for OTA bookings to prevent duplicates
-- Only applies when external_source is not null (OTA bookings)
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_external_unique 
ON public.bookings (external_source, external_booking_id) 
WHERE external_source IS NOT NULL AND external_booking_id IS NOT NULL;

-- 2. Create channel room mappings table
CREATE TABLE IF NOT EXISTS public.channel_room_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_connection_id UUID NOT NULL REFERENCES public.channel_connections(id) ON DELETE CASCADE,
  external_room_type_id TEXT,
  external_room_name TEXT NOT NULL,
  internal_room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(channel_connection_id, external_room_name)
);

-- Enable RLS on channel_room_mappings
ALTER TABLE public.channel_room_mappings ENABLE ROW LEVEL SECURITY;

-- RLS policies for channel_room_mappings
CREATE POLICY "Staff can view room mappings"
ON public.channel_room_mappings FOR SELECT
USING (is_staff());

CREATE POLICY "Admin/Manager can insert room mappings"
ON public.channel_room_mappings FOR INSERT
WITH CHECK (is_admin() OR is_manager());

CREATE POLICY "Admin/Manager can update room mappings"
ON public.channel_room_mappings FOR UPDATE
USING (is_admin() OR is_manager());

CREATE POLICY "Admin can delete room mappings"
ON public.channel_room_mappings FOR DELETE
USING (is_admin());

-- Add trigger for updated_at
CREATE TRIGGER update_channel_room_mappings_updated_at
BEFORE UPDATE ON public.channel_room_mappings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Create function to check for booking overlaps
CREATE OR REPLACE FUNCTION public.check_booking_overlap(
  p_room_id UUID,
  p_check_in DATE,
  p_check_out DATE,
  p_exclude_booking_id UUID DEFAULT NULL
)
RETURNS TABLE(
  has_overlap BOOLEAN,
  conflicting_booking_id UUID,
  conflicting_check_in DATE,
  conflicting_check_out DATE,
  conflicting_guest_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TRUE AS has_overlap,
    b.id AS conflicting_booking_id,
    b.check_in AS conflicting_check_in,
    b.check_out AS conflicting_check_out,
    g.name AS conflicting_guest_name
  FROM public.bookings b
  JOIN public.guests g ON g.id = b.guest_id
  WHERE b.room_id = p_room_id
    AND b.status NOT IN ('cancelled', 'archived')
    AND (p_exclude_booking_id IS NULL OR b.id != p_exclude_booking_id)
    AND b.check_in < p_check_out
    AND b.check_out > p_check_in
  LIMIT 1;
  
  -- If no rows returned, return a "no overlap" row
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::DATE, NULL::DATE, NULL::TEXT;
  END IF;
END;
$$;

-- 4. Create trigger to prevent overlapping bookings at DB level
CREATE OR REPLACE FUNCTION public.prevent_booking_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  overlap_record RECORD;
BEGIN
  -- Skip cancelled/archived bookings
  IF NEW.status IN ('cancelled', 'archived') THEN
    RETURN NEW;
  END IF;
  
  -- Check for overlaps
  SELECT * INTO overlap_record
  FROM public.check_booking_overlap(
    NEW.room_id,
    NEW.check_in,
    NEW.check_out,
    CASE WHEN TG_OP = 'UPDATE' THEN NEW.id ELSE NULL END
  )
  WHERE has_overlap = TRUE;
  
  IF overlap_record.has_overlap THEN
    RAISE EXCEPTION 'Room is already booked for these dates (% to % by %)', 
      overlap_record.conflicting_check_in,
      overlap_record.conflicting_check_out,
      overlap_record.conflicting_guest_name;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for booking overlap prevention
DROP TRIGGER IF EXISTS trigger_prevent_booking_overlap ON public.bookings;
CREATE TRIGGER trigger_prevent_booking_overlap
BEFORE INSERT OR UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.prevent_booking_overlap();

-- 5. Add last_error_message to channel_connections for better error visibility
ALTER TABLE public.channel_connections 
ADD COLUMN IF NOT EXISTS last_error_message TEXT;

-- 6. Update RLS policies to restrict staff from deleting/modifying sensitive data
-- Staff cannot delete bookings (already exists but let's ensure it's strict)
DROP POLICY IF EXISTS "Admin/Manager can delete bookings" ON public.bookings;
CREATE POLICY "Only Admin can delete bookings"
ON public.bookings FOR DELETE
USING (is_admin());

-- Staff cannot modify channel connections
DROP POLICY IF EXISTS "Admin/Manager can update channel connections" ON public.channel_connections;
CREATE POLICY "Only Admin can update channel connections"
ON public.channel_connections FOR UPDATE
USING (is_admin());

DROP POLICY IF EXISTS "Admin/Manager can insert channel connections" ON public.channel_connections;
CREATE POLICY "Only Admin can insert channel connections"
ON public.channel_connections FOR INSERT
WITH CHECK (is_admin());

-- Staff cannot modify inventory settings
DROP POLICY IF EXISTS "Admin/Manager can update inventory settings" ON public.property_inventory_settings;
CREATE POLICY "Only Admin can update inventory settings"
ON public.property_inventory_settings FOR UPDATE
USING (is_admin());

DROP POLICY IF EXISTS "Admin/Manager can insert inventory settings" ON public.property_inventory_settings;
CREATE POLICY "Only Admin can insert inventory settings"
ON public.property_inventory_settings FOR INSERT
WITH CHECK (is_admin());
-- Add database-level validation to ensure booking property matches room property
-- This trigger prevents bookings from being created with mismatched property_id

CREATE OR REPLACE FUNCTION public.validate_booking_property_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  room_property_id UUID;
BEGIN
  -- Get the property_id from the room
  SELECT property_id INTO room_property_id 
  FROM public.rooms 
  WHERE id = NEW.room_id;
  
  -- If room has a property_id, booking must match
  IF room_property_id IS NOT NULL THEN
    IF NEW.property_id IS NULL THEN
      RAISE EXCEPTION 'Property mismatch: Booking must have a property_id that matches the room property';
    END IF;
    
    IF NEW.property_id != room_property_id THEN
      RAISE EXCEPTION 'Property mismatch: Booking property_id (%) does not match room property_id (%)', NEW.property_id, room_property_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to validate on insert and update
DROP TRIGGER IF EXISTS validate_booking_property_match_trigger ON public.bookings;
CREATE TRIGGER validate_booking_property_match_trigger
  BEFORE INSERT OR UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_booking_property_match();

-- Add indexes for better query performance on property-filtered queries
CREATE INDEX IF NOT EXISTS idx_bookings_property_checkin ON public.bookings(property_id, check_in, check_out);
CREATE INDEX IF NOT EXISTS idx_rooms_property ON public.rooms(property_id);
CREATE INDEX IF NOT EXISTS idx_room_availability_property_room_date ON public.room_availability(room_id, date);
CREATE INDEX IF NOT EXISTS idx_guest_services_property ON public.guest_services(property_id);
CREATE INDEX IF NOT EXISTS idx_payments_property ON public.payments(property_id);
CREATE INDEX IF NOT EXISTS idx_invoices_property ON public.invoices(property_id);
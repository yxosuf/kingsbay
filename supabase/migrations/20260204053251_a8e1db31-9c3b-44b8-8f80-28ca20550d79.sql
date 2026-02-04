-- Add booking source enum
CREATE TYPE public.booking_source AS ENUM ('direct', 'booking_com', 'airbnb', 'agoda', 'expedia', 'other_ota');

-- Add OTA pricing columns to bookings table
ALTER TABLE public.bookings
ADD COLUMN booking_source booking_source NOT NULL DEFAULT 'direct',
ADD COLUMN ota_price numeric DEFAULT NULL,
ADD COLUMN commission_rate numeric DEFAULT NULL,
ADD COLUMN commission_amount numeric DEFAULT NULL,
ADD COLUMN ota_reference text DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.bookings.total_amount IS 'System calculated room price (rack rate)';
COMMENT ON COLUMN public.bookings.ota_price IS 'Actual price received from OTA after their commission';
COMMENT ON COLUMN public.bookings.commission_rate IS 'OTA commission percentage (e.g., 15 for 15%)';
COMMENT ON COLUMN public.bookings.commission_amount IS 'Calculated commission amount';
COMMENT ON COLUMN public.bookings.ota_reference IS 'OTA booking reference number';
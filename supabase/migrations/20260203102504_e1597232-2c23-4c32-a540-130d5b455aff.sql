-- Add server-side validation constraints to all tables
-- This ensures data integrity even if client-side validation is bypassed

-- ============================================
-- GUESTS TABLE CONSTRAINTS
-- ============================================
-- Name: required, reasonable length
ALTER TABLE public.guests ADD CONSTRAINT guests_name_length CHECK (char_length(name) >= 1 AND char_length(name) <= 200);

-- Phone: reasonable length if provided
ALTER TABLE public.guests ADD CONSTRAINT guests_phone_length CHECK (phone IS NULL OR (char_length(phone) >= 5 AND char_length(phone) <= 30));

-- Email: reasonable length and basic format if provided
ALTER TABLE public.guests ADD CONSTRAINT guests_email_length CHECK (email IS NULL OR (char_length(email) >= 5 AND char_length(email) <= 255));
ALTER TABLE public.guests ADD CONSTRAINT guests_email_format CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- ID/Passport: reasonable length if provided
ALTER TABLE public.guests ADD CONSTRAINT guests_id_passport_length CHECK (id_passport IS NULL OR char_length(id_passport) <= 50);

-- Address: reasonable length if provided
ALTER TABLE public.guests ADD CONSTRAINT guests_address_length CHECK (address IS NULL OR char_length(address) <= 500);

-- Nationality: reasonable length if provided
ALTER TABLE public.guests ADD CONSTRAINT guests_nationality_length CHECK (nationality IS NULL OR char_length(nationality) <= 100);

-- Notes: reasonable length if provided
ALTER TABLE public.guests ADD CONSTRAINT guests_notes_length CHECK (notes IS NULL OR char_length(notes) <= 2000);

-- ============================================
-- ROOMS TABLE CONSTRAINTS
-- ============================================
-- Room number: required, reasonable length
ALTER TABLE public.rooms ADD CONSTRAINT rooms_room_number_length CHECK (char_length(room_number) >= 1 AND char_length(room_number) <= 20);

-- Price: must be non-negative
ALTER TABLE public.rooms ADD CONSTRAINT rooms_price_non_negative CHECK (price >= 0);

-- Room type: reasonable length
ALTER TABLE public.rooms ADD CONSTRAINT rooms_room_type_length CHECK (char_length(room_type) >= 1 AND char_length(room_type) <= 50);

-- Max guests: must be positive if provided
ALTER TABLE public.rooms ADD CONSTRAINT rooms_max_guests_positive CHECK (max_guests IS NULL OR max_guests > 0);

-- Floor: reasonable range if provided
ALTER TABLE public.rooms ADD CONSTRAINT rooms_floor_range CHECK (floor IS NULL OR (floor >= -5 AND floor <= 200));

-- Description: reasonable length if provided
ALTER TABLE public.rooms ADD CONSTRAINT rooms_description_length CHECK (description IS NULL OR char_length(description) <= 1000);

-- ============================================
-- SERVICES TABLE CONSTRAINTS
-- ============================================
-- Name: required, reasonable length
ALTER TABLE public.services ADD CONSTRAINT services_name_length CHECK (char_length(name) >= 1 AND char_length(name) <= 200);

-- Price: must be non-negative
ALTER TABLE public.services ADD CONSTRAINT services_price_non_negative CHECK (price >= 0);

-- Description: reasonable length if provided
ALTER TABLE public.services ADD CONSTRAINT services_description_length CHECK (description IS NULL OR char_length(description) <= 1000);

-- ============================================
-- BOOKINGS TABLE CONSTRAINTS
-- ============================================
-- Num guests: must be positive
ALTER TABLE public.bookings ADD CONSTRAINT bookings_num_guests_positive CHECK (num_guests IS NULL OR num_guests > 0);

-- Total amount: must be non-negative
ALTER TABLE public.bookings ADD CONSTRAINT bookings_total_amount_non_negative CHECK (total_amount IS NULL OR total_amount >= 0);

-- Special requests: reasonable length if provided
ALTER TABLE public.bookings ADD CONSTRAINT bookings_special_requests_length CHECK (special_requests IS NULL OR char_length(special_requests) <= 2000);

-- Check-out must be after check-in (using trigger instead of CHECK for time-based validation)
CREATE OR REPLACE FUNCTION public.validate_booking_dates()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.check_out <= NEW.check_in THEN
    RAISE EXCEPTION 'Check-out date must be after check-in date';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER validate_booking_dates_trigger
BEFORE INSERT OR UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.validate_booking_dates();

-- ============================================
-- GUEST_SERVICES TABLE CONSTRAINTS
-- ============================================
-- Quantity: must be positive
ALTER TABLE public.guest_services ADD CONSTRAINT guest_services_quantity_positive CHECK (quantity > 0);

-- Unit price: must be non-negative
ALTER TABLE public.guest_services ADD CONSTRAINT guest_services_unit_price_non_negative CHECK (unit_price >= 0);

-- Total price: must be non-negative
ALTER TABLE public.guest_services ADD CONSTRAINT guest_services_total_price_non_negative CHECK (total_price >= 0);

-- Notes: reasonable length if provided
ALTER TABLE public.guest_services ADD CONSTRAINT guest_services_notes_length CHECK (notes IS NULL OR char_length(notes) <= 1000);

-- ============================================
-- INVOICES TABLE CONSTRAINTS
-- ============================================
-- Invoice number: reasonable length
ALTER TABLE public.invoices ADD CONSTRAINT invoices_invoice_number_length CHECK (char_length(invoice_number) >= 1 AND char_length(invoice_number) <= 50);

-- All monetary amounts: must be non-negative
ALTER TABLE public.invoices ADD CONSTRAINT invoices_room_charges_non_negative CHECK (room_charges >= 0);
ALTER TABLE public.invoices ADD CONSTRAINT invoices_service_charges_non_negative CHECK (service_charges >= 0);
ALTER TABLE public.invoices ADD CONSTRAINT invoices_tax_amount_non_negative CHECK (tax_amount >= 0);
ALTER TABLE public.invoices ADD CONSTRAINT invoices_total_amount_non_negative CHECK (total_amount >= 0);

-- Notes: reasonable length if provided
ALTER TABLE public.invoices ADD CONSTRAINT invoices_notes_length CHECK (notes IS NULL OR char_length(notes) <= 2000);

-- ============================================
-- PAYMENTS TABLE CONSTRAINTS
-- ============================================
-- Amount: must be positive
ALTER TABLE public.payments ADD CONSTRAINT payments_amount_positive CHECK (amount > 0);

-- Reference number: reasonable length if provided
ALTER TABLE public.payments ADD CONSTRAINT payments_reference_number_length CHECK (reference_number IS NULL OR char_length(reference_number) <= 100);

-- Notes: reasonable length if provided
ALTER TABLE public.payments ADD CONSTRAINT payments_notes_length CHECK (notes IS NULL OR char_length(notes) <= 1000);

-- ============================================
-- PROFILES TABLE CONSTRAINTS
-- ============================================
-- Full name: reasonable length if provided
ALTER TABLE public.profiles ADD CONSTRAINT profiles_full_name_length CHECK (full_name IS NULL OR char_length(full_name) <= 200);

-- Email: reasonable length and basic format if provided
ALTER TABLE public.profiles ADD CONSTRAINT profiles_email_length CHECK (email IS NULL OR (char_length(email) >= 5 AND char_length(email) <= 255));
ALTER TABLE public.profiles ADD CONSTRAINT profiles_email_format CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Avatar URL: reasonable length if provided
ALTER TABLE public.profiles ADD CONSTRAINT profiles_avatar_url_length CHECK (avatar_url IS NULL OR char_length(avatar_url) <= 500);
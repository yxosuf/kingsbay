-- Add pending_checkin status for QR check-in flow
ALTER TYPE public.booking_status ADD VALUE IF NOT EXISTS 'pending_checkin' AFTER 'pending';
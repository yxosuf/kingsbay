
-- Add indexes to speed up common queries
CREATE INDEX IF NOT EXISTS idx_bookings_property_status ON public.bookings (property_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_check_in ON public.bookings (check_in);
CREATE INDEX IF NOT EXISTS idx_bookings_check_out ON public.bookings (check_out);
CREATE INDEX IF NOT EXISTS idx_bookings_room_status ON public.bookings (room_id, status);
CREATE INDEX IF NOT EXISTS idx_guests_auth_user_id ON public.guests (auth_user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_rooms_property_id ON public.rooms (property_id);
CREATE INDEX IF NOT EXISTS idx_room_availability_room_date ON public.room_availability (room_id, date);
CREATE INDEX IF NOT EXISTS idx_notifications_user_property ON public.notifications (user_id, property_id, is_read);
CREATE INDEX IF NOT EXISTS idx_booking_transactions_booking ON public.booking_transactions (booking_id);
CREATE INDEX IF NOT EXISTS idx_guest_services_booking ON public.guest_services (booking_id);

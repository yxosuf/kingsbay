
-- Trigger function: auto-create notifications on booking changes
CREATE OR REPLACE FUNCTION public.notify_booking_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  notif_title TEXT;
  notif_message TEXT;
  notif_priority TEXT;
  notif_category TEXT;
  notif_action TEXT;
  guest_name TEXT;
  room_number TEXT;
  source_label TEXT;
BEGIN
  -- Get guest name and room number
  SELECT g.name INTO guest_name FROM public.guests g WHERE g.id = NEW.guest_id;
  SELECT r.room_number INTO room_number FROM public.rooms r WHERE r.id = NEW.room_id;

  -- Determine booking source label
  CASE NEW.booking_source
    WHEN 'airbnb' THEN source_label := 'Airbnb';
    WHEN 'booking_com' THEN source_label := 'Booking.com';
    WHEN 'agoda' THEN source_label := 'Agoda';
    WHEN 'expedia' THEN source_label := 'Expedia';
    ELSE source_label := 'Direct';
  END CASE;

  IF TG_OP = 'INSERT' THEN
    notif_title := 'New ' || source_label || ' Booking';
    notif_message := format('%s – Room %s, %s to %s', COALESCE(guest_name, 'Guest'), COALESCE(room_number, '?'), NEW.check_in, NEW.check_out);
    notif_priority := 'high';
    notif_category := 'booking';
    notif_action := 'view_booking';

    IF NEW.needs_review = TRUE THEN
      notif_title := notif_title || ' (Needs Review)';
    END IF;

  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    CASE NEW.status
      WHEN 'checked_in' THEN
        notif_title := 'Guest Checked In';
        notif_message := format('%s → Room %s', COALESCE(guest_name, 'Guest'), COALESCE(room_number, '?'));
        notif_priority := 'medium';
        notif_category := 'checkin_checkout';
        notif_action := 'view_booking';
      WHEN 'checked_out' THEN
        notif_title := 'Guest Checked Out';
        notif_message := format('%s ← Room %s', COALESCE(guest_name, 'Guest'), COALESCE(room_number, '?'));
        notif_priority := 'medium';
        notif_category := 'checkin_checkout';
        notif_action := 'view_room';
      WHEN 'cancelled' THEN
        notif_title := source_label || ' Booking Cancelled';
        notif_message := format('%s – Room %s, %s to %s', COALESCE(guest_name, 'Guest'), COALESCE(room_number, '?'), NEW.check_in, NEW.check_out);
        notif_priority := 'high';
        notif_category := 'booking';
        notif_action := 'view_booking';
      WHEN 'no_show' THEN
        notif_title := 'No-Show Recorded';
        notif_message := format('%s – Room %s', COALESCE(guest_name, 'Guest'), COALESCE(room_number, '?'));
        notif_priority := 'high';
        notif_category := 'booking';
        notif_action := 'view_booking';
      WHEN 'confirmed' THEN
        notif_title := 'Booking Confirmed';
        notif_message := format('%s – Room %s, %s to %s', COALESCE(guest_name, 'Guest'), COALESCE(room_number, '?'), NEW.check_in, NEW.check_out);
        notif_priority := 'medium';
        notif_category := 'booking';
        notif_action := 'view_booking';
      ELSE
        RETURN NEW;
    END CASE;
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (
    property_id, type, category, priority, title, message, link,
    target_roles, action_type, action_entity_id
  ) VALUES (
    NEW.property_id, notif_category, notif_category, notif_priority, notif_title, notif_message,
    '/bookings/' || NEW.id,
    ARRAY['admin', 'manager', 'front_desk']::text[],
    notif_action, NEW.id
  );

  RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER trg_booking_notification
AFTER INSERT OR UPDATE ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.notify_booking_change();


CREATE OR REPLACE FUNCTION public.clear_property_data(p_property_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  deleted_counts jsonb;
  cnt_payments int;
  cnt_guest_services int;
  cnt_invoices int;
  cnt_bookings int;
  cnt_guests int;
  cnt_availability int;
  cnt_sync_logs int;
  cnt_notifications int;
  cnt_ledger_lines int;
  cnt_ledger_entries int;
  cnt_transactions int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can clear property data';
  END IF;

  -- Delete ledger lines for this property's entries
  DELETE FROM public.ledger_lines WHERE entry_id IN (
    SELECT id FROM public.ledger_entries WHERE property_id = p_property_id
  );
  GET DIAGNOSTICS cnt_ledger_lines = ROW_COUNT;

  DELETE FROM public.ledger_entries WHERE property_id = p_property_id;
  GET DIAGNOSTICS cnt_ledger_entries = ROW_COUNT;

  DELETE FROM public.booking_transactions WHERE property_id = p_property_id;
  GET DIAGNOSTICS cnt_transactions = ROW_COUNT;

  DELETE FROM public.payments WHERE property_id = p_property_id;
  GET DIAGNOSTICS cnt_payments = ROW_COUNT;

  DELETE FROM public.guest_services WHERE property_id = p_property_id;
  GET DIAGNOSTICS cnt_guest_services = ROW_COUNT;

  DELETE FROM public.invoices WHERE property_id = p_property_id;
  GET DIAGNOSTICS cnt_invoices = ROW_COUNT;

  DELETE FROM public.room_availability WHERE room_id IN (
    SELECT id FROM public.rooms WHERE property_id = p_property_id
  );
  GET DIAGNOSTICS cnt_availability = ROW_COUNT;

  DELETE FROM public.sync_logs WHERE channel_id IN (
    SELECT id FROM public.channel_connections WHERE property_id = p_property_id
  );
  GET DIAGNOSTICS cnt_sync_logs = ROW_COUNT;

  DELETE FROM public.bookings WHERE property_id = p_property_id;
  GET DIAGNOSTICS cnt_bookings = ROW_COUNT;

  DELETE FROM public.guest_view_logs WHERE property_id = p_property_id;

  DELETE FROM public.guests WHERE property_id = p_property_id;
  GET DIAGNOSTICS cnt_guests = ROW_COUNT;

  DELETE FROM public.notifications WHERE property_id = p_property_id;
  GET DIAGNOSTICS cnt_notifications = ROW_COUNT;

  DELETE FROM public.email_ingest_logs WHERE property_id = p_property_id;

  deleted_counts := jsonb_build_object(
    'payments', cnt_payments,
    'guest_services', cnt_guest_services,
    'invoices', cnt_invoices,
    'bookings', cnt_bookings,
    'guests', cnt_guests,
    'room_availability', cnt_availability,
    'sync_logs', cnt_sync_logs,
    'notifications', cnt_notifications,
    'ledger_lines', cnt_ledger_lines,
    'ledger_entries', cnt_ledger_entries,
    'booking_transactions', cnt_transactions
  );

  RETURN deleted_counts;
END;
$function$;

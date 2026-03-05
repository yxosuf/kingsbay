CREATE OR REPLACE FUNCTION public.check_booking_overlap(p_room_id uuid, p_check_in date, p_check_out date, p_exclude_booking_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(has_overlap boolean, conflicting_booking_id uuid, conflicting_check_in date, conflicting_check_out date, conflicting_guest_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    AND b.status NOT IN ('cancelled', 'archived', 'checked_out', 'no_show')
    AND (p_exclude_booking_id IS NULL OR b.id != p_exclude_booking_id)
    AND b.check_in < p_check_out
    AND b.check_out > p_check_in
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::DATE, NULL::DATE, NULL::TEXT;
  END IF;
END;
$function$;
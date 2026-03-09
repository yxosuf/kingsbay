CREATE OR REPLACE VIEW public.dashboard_kpi_metrics AS
SELECT
  property_id,
  COUNT(*) FILTER (WHERE status = 'checked_in') AS rooms_occupied,
  COUNT(*) FILTER (WHERE check_in = CURRENT_DATE AND status IN ('pending', 'confirmed')) AS arrivals_today,
  COUNT(*) FILTER (WHERE check_out = CURRENT_DATE AND status = 'checked_in') AS departures_today,
  COUNT(*) FILTER (WHERE check_in = CURRENT_DATE AND booking_source = 'direct' AND status IN ('pending', 'confirmed', 'checked_in')) AS walkins_today,
  COUNT(*) FILTER (WHERE booking_source = 'direct' AND created_at >= date_trunc('month', CURRENT_DATE)) AS direct_bookings_month,
  COUNT(*) FILTER (WHERE booking_source IN ('airbnb', 'booking_com', 'agoda', 'expedia', 'other_ota') AND created_at >= date_trunc('month', CURRENT_DATE)) AS ota_bookings_month,
  COUNT(*) FILTER (WHERE booking_source = 'airbnb' AND created_at >= date_trunc('month', CURRENT_DATE)) AS airbnb_bookings_month,
  COUNT(*) FILTER (WHERE booking_source = 'booking_com' AND created_at >= date_trunc('month', CURRENT_DATE)) AS bookingcom_bookings_month,
  COUNT(*) FILTER (WHERE booking_source = 'agoda' AND created_at >= date_trunc('month', CURRENT_DATE)) AS agoda_bookings_month,
  COUNT(*) FILTER (WHERE booking_source = 'expedia' AND created_at >= date_trunc('month', CURRENT_DATE)) AS expedia_bookings_month,
  COALESCE(SUM(commission_amount) FILTER (WHERE booking_source IN ('airbnb', 'booking_com', 'agoda', 'expedia', 'other_ota') AND created_at >= date_trunc('month', CURRENT_DATE)), 0) AS ota_commission_month,
  COALESCE(SUM(total_amount) FILTER (WHERE booking_source IN ('airbnb', 'booking_com', 'agoda', 'expedia', 'other_ota') AND created_at >= date_trunc('month', CURRENT_DATE)), 0) AS ota_revenue_month
FROM public.bookings
WHERE status NOT IN ('cancelled', 'no_show', 'archived')
GROUP BY property_id;

CREATE OR REPLACE VIEW public.dashboard_revenue_metrics AS
SELECT
  property_id,
  COALESCE(SUM(total_amount) FILTER (WHERE DATE(created_at) = CURRENT_DATE), 0) AS revenue_today,
  COALESCE(SUM(total_amount) FILTER (WHERE created_at >= date_trunc('week', CURRENT_DATE)), 0) AS revenue_week,
  COALESCE(SUM(total_amount) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE)), 0) AS revenue_month,
  COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE)) AS invoices_month
FROM public.invoices
GROUP BY property_id;

CREATE OR REPLACE VIEW public.dashboard_room_metrics AS
SELECT
  property_id,
  COUNT(*) AS total_rooms,
  COUNT(*) FILTER (WHERE status != 'maintenance') AS available_rooms
FROM public.rooms
GROUP BY property_id;

GRANT SELECT ON public.dashboard_kpi_metrics TO authenticated;
GRANT SELECT ON public.dashboard_revenue_metrics TO authenticated;
GRANT SELECT ON public.dashboard_room_metrics TO authenticated;
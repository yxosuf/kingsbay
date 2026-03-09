-- Fix security definer views by setting them to use invoker's permissions
ALTER VIEW public.dashboard_kpi_metrics SET (security_invoker = on);
ALTER VIEW public.dashboard_revenue_metrics SET (security_invoker = on);
ALTER VIEW public.dashboard_room_metrics SET (security_invoker = on);
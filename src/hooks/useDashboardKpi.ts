import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProperty } from '@/hooks/useProperty';

export interface KpiMetrics {
  rooms_occupied: number;
  arrivals_today: number;
  departures_today: number;
  walkins_today: number;
  direct_bookings_month: number;
  ota_bookings_month: number;
  airbnb_bookings_month: number;
  bookingcom_bookings_month: number;
  agoda_bookings_month: number;
  expedia_bookings_month: number;
  ota_commission_month: number;
  ota_revenue_month: number;
}

export interface RevenueMetrics {
  revenue_today: number;
  revenue_week: number;
  revenue_month: number;
  invoices_month: number;
}

export interface RoomMetrics {
  total_rooms: number;
  available_rooms: number;
}

const emptyKpi: KpiMetrics = {
  rooms_occupied: 0, arrivals_today: 0, departures_today: 0, walkins_today: 0,
  direct_bookings_month: 0, ota_bookings_month: 0,
  airbnb_bookings_month: 0, bookingcom_bookings_month: 0,
  agoda_bookings_month: 0, expedia_bookings_month: 0,
  ota_commission_month: 0, ota_revenue_month: 0,
};

const emptyRevenue: RevenueMetrics = {
  revenue_today: 0, revenue_week: 0, revenue_month: 0, invoices_month: 0,
};

const emptyRooms: RoomMetrics = { total_rooms: 0, available_rooms: 0 };

async function fetchKpi(propertyId: string | null, showAll: boolean) {
  // Fetch all three views in parallel
  let kpiQ = supabase.from('dashboard_kpi_metrics' as any).select('*');
  let revQ = supabase.from('dashboard_revenue_metrics' as any).select('*');
  let roomQ = supabase.from('dashboard_room_metrics' as any).select('*');

  if (!showAll && propertyId) {
    kpiQ = kpiQ.eq('property_id', propertyId);
    revQ = revQ.eq('property_id', propertyId);
    roomQ = roomQ.eq('property_id', propertyId);
  }

  const [{ data: kpiRows }, { data: revRows }, { data: roomRows }] = await Promise.all([kpiQ, revQ, roomQ]);

  // Aggregate across properties if "All Properties"
  const kpi = (kpiRows as any[] || []).reduce((acc: KpiMetrics, row: any) => ({
    rooms_occupied: acc.rooms_occupied + Number(row.rooms_occupied || 0),
    arrivals_today: acc.arrivals_today + Number(row.arrivals_today || 0),
    departures_today: acc.departures_today + Number(row.departures_today || 0),
    walkins_today: acc.walkins_today + Number(row.walkins_today || 0),
    direct_bookings_month: acc.direct_bookings_month + Number(row.direct_bookings_month || 0),
    ota_bookings_month: acc.ota_bookings_month + Number(row.ota_bookings_month || 0),
    airbnb_bookings_month: acc.airbnb_bookings_month + Number(row.airbnb_bookings_month || 0),
    bookingcom_bookings_month: acc.bookingcom_bookings_month + Number(row.bookingcom_bookings_month || 0),
    agoda_bookings_month: acc.agoda_bookings_month + Number(row.agoda_bookings_month || 0),
    expedia_bookings_month: acc.expedia_bookings_month + Number(row.expedia_bookings_month || 0),
    ota_commission_month: acc.ota_commission_month + Number(row.ota_commission_month || 0),
    ota_revenue_month: acc.ota_revenue_month + Number(row.ota_revenue_month || 0),
  }), { ...emptyKpi });

  const revenue = (revRows as any[] || []).reduce((acc: RevenueMetrics, row: any) => ({
    revenue_today: acc.revenue_today + Number(row.revenue_today || 0),
    revenue_week: acc.revenue_week + Number(row.revenue_week || 0),
    revenue_month: acc.revenue_month + Number(row.revenue_month || 0),
    invoices_month: acc.invoices_month + Number(row.invoices_month || 0),
  }), { ...emptyRevenue });

  const rooms = (roomRows as any[] || []).reduce((acc: RoomMetrics, row: any) => ({
    total_rooms: acc.total_rooms + Number(row.total_rooms || 0),
    available_rooms: acc.available_rooms + Number(row.available_rooms || 0),
  }), { ...emptyRooms });

  return { kpi, revenue, rooms };
}

export function useDashboardKpi() {
  const { selectedProperty, showAllProperties } = useProperty();
  const propertyId = selectedProperty?.id ?? null;

  return useQuery({
    queryKey: ['dashboard-kpi', propertyId, showAllProperties],
    queryFn: () => fetchKpi(propertyId, showAllProperties),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

import { useState, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, Search, Download, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useProperty } from '@/hooks/useProperty';
import { useAuth } from '@/hooks/useAuth';
import { PropertyBadge } from '@/components/layout/PropertyBadge';
import { BookingTable, type BookingRow } from '@/components/booking/BookingTable';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { BulkActionBar } from '@/components/ui/BulkActionBar';
import { useBulkSelection } from '@/hooks/useBulkSelection';
import { exportToPdf, exportToExcel } from '@/lib/exportUtils';
import { toDateString } from '@/lib/dateUtils';
import { toast } from 'sonner';
import { BookOpen } from 'lucide-react';

type TabKey = 'today' | 'upcoming' | 'inhouse' | 'past' | 'cancelled' | 'needs_review' | 'all';

const TAB_LABELS: Record<TabKey, string> = {
  today: 'Today',
  upcoming: 'Upcoming',
  inhouse: 'In-house',
  past: 'Past',
  cancelled: 'Cancelled',
  needs_review: 'Needs Review',
  all: 'All',
};

const PAGE_SIZE = 25;

function applyTabFilter(query: any, activeTab: TabKey) {
  const today = toDateString(new Date());
  switch (activeTab) {
    case 'today':
      return query.or(`and(check_in.eq.${today},status.in.(confirmed,pending)),and(check_out.eq.${today},status.eq.checked_in)`);
    case 'upcoming':
      return query.gt('check_in', today).eq('status', 'confirmed');
    case 'inhouse':
      return query.eq('status', 'checked_in');
    case 'past':
      return query.eq('status', 'checked_out');
    case 'cancelled':
      return query.in('status', ['cancelled', 'no_show']);
    case 'needs_review':
      return query.eq('status', 'needs_review');
    case 'all':
    default:
      return query;
  }
}

export default function Bookings() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { selectedProperty, showAllProperties } = useProperty();
  const { isAdmin, canWrite } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    const filter = searchParams.get('filter');
    if (filter && Object.keys(TAB_LABELS).includes(filter)) return filter as TabKey;
    return 'today';
  });

  // Debounced search
  const debounceRef = useState<ReturnType<typeof setTimeout> | null>(null);
  const handleSearch = useCallback((value: string) => {
    setSearchTerm(value);
    if (debounceRef[0]) clearTimeout(debounceRef[0]);
    debounceRef[0] = setTimeout(() => { setDebouncedSearch(value); setPage(0); }, 300);
  }, [debounceRef]);

  const propertyId = selectedProperty?.id ?? null;

  // Count query
  const { data: totalCount = 0 } = useQuery({
    queryKey: ['bookings-count', propertyId, showAllProperties, activeTab],
    queryFn: async () => {
      let query = supabase.from('bookings').select('*', { count: 'exact', head: true });
      if (!showAllProperties && propertyId) query = query.eq('property_id', propertyId);
      query = applyTabFilter(query, activeTab);
      const { count, error } = await query;
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 30_000,
  });

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data: bookings = [], isLoading: loading, isFetching, refetch } = useQuery({
    queryKey: ['bookings', propertyId, showAllProperties, activeTab, page],
    queryFn: async () => {
      let query = supabase
        .from('bookings')
        .select(`
          id, check_in, check_out, status, num_guests, total_amount,
          room_id, property_id, booking_source, needs_review, review_reason,
          hold_expires_at,
          guests (name, phone),
          rooms (room_number, room_type)
        `)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (!showAllProperties && propertyId) query = query.eq('property_id', propertyId);
      query = applyTabFilter(query, activeTab);

      const { data, error } = await query;
      if (error) throw error;
      return (data as BookingRow[]) || [];
    },
  });

  const filteredBookings = useMemo(() => {
    if (!debouncedSearch) return bookings;
    const term = debouncedSearch.toLowerCase();
    return bookings.filter(
      (b) =>
        b.guests?.name?.toLowerCase().includes(term) ||
        b.rooms?.room_number?.toLowerCase().includes(term)
    );
  }, [bookings, debouncedSearch]);

  const handleTabChange = (v: string) => {
    setActiveTab(v as TabKey);
    setPage(0);
  };

  const tabs: TabKey[] = ['today', 'upcoming', 'inhouse', 'past', 'cancelled', 'needs_review'];
  if (isAdmin) tabs.push('all');

  return (
    <DashboardLayout title="Bookings">
      <div className="space-y-4 sm:space-y-5">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Viewing:</span>
          <PropertyBadge />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4 sm:justify-between">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search guest or room..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10 rounded-xl shadow-sm focus:shadow-md transition-shadow"
            />
          </div>
          {canWrite && (
            <Button onClick={() => navigate('/bookings/new')} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              New Booking
            </Button>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-muted/50 p-1 rounded-2xl">
            {tabs.map((tab) => (
              <TabsTrigger key={tab} value={tab} className="text-xs sm:text-sm rounded-xl gap-1.5">
                {TAB_LABELS[tab]}
                {!loading && tab === activeTab && totalCount > 0 && (
                  <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px] rounded-full">
                    {totalCount}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {tabs.map((tab) => (
            <TabsContent key={tab} value={tab}>
              <Card>
                <CardContent className="px-3 sm:px-6 pt-4 sm:pt-6">
                  {loading ? (
                    <TableSkeleton rows={6} columns={7} />
                  ) : filteredBookings.length === 0 ? (
                    <EmptyState
                      icon={BookOpen}
                      title="No bookings found"
                      description={activeTab === 'today' ? "No arrivals or departures today." : "No bookings match this filter."}
                      actionLabel={canWrite ? "New Booking" : undefined}
                      onAction={canWrite ? () => navigate('/bookings/new') : undefined}
                    />
                  ) : (
                    <>
                      <BookingTable
                        bookings={filteredBookings}
                        loading={false}
                        onActionComplete={() => refetch()}
                      />
                      <PaginationControls
                        page={page}
                        totalPages={totalPages}
                        totalCount={totalCount}
                        pageSize={PAGE_SIZE}
                        hasNextPage={page < totalPages - 1}
                        hasPreviousPage={page > 0}
                        onNextPage={() => setPage(p => Math.min(p + 1, totalPages - 1))}
                        onPreviousPage={() => setPage(p => Math.max(p - 1, 0))}
                        onGoToPage={setPage}
                        isFetching={isFetching}
                      />
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

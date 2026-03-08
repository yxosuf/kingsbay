import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useProperty } from '@/hooks/useProperty';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { PropertyBadge } from '@/components/layout/PropertyBadge';
import { BookingTable, type BookingRow } from '@/components/booking/BookingTable';
import { toDateString } from '@/lib/dateUtils';

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

export default function Bookings() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { selectedProperty, showAllProperties } = useProperty();
  const { isAdmin, canWrite } = useAuth();
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    const filter = searchParams.get('filter');
    if (filter && Object.keys(TAB_LABELS).includes(filter)) return filter as TabKey;
    return 'today';
  });

  const today = toDateString(new Date());

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('bookings')
        .select(`
          id, check_in, check_out, status, num_guests, total_amount,
          room_id, property_id, booking_source, needs_review, review_reason,
          hold_expires_at,
          guests (name, phone),
          rooms (room_number, room_type)
        `)
        .order('created_at', { ascending: false });

      if (!showAllProperties && selectedProperty?.id) {
        query = query.eq('property_id', selectedProperty.id);
      }

      switch (activeTab) {
        case 'today':
          query = query.or(`and(check_in.eq.${today},status.in.(confirmed,pending)),and(check_out.eq.${today},status.eq.checked_in)`);
          break;
        case 'upcoming':
          query = query.gt('check_in', today).eq('status', 'confirmed');
          break;
        case 'inhouse':
          query = query.eq('status', 'checked_in');
          break;
        case 'past':
          query = query.eq('status', 'checked_out');
          break;
        case 'cancelled':
          query = query.in('status', ['cancelled', 'no_show']);
          break;
        case 'needs_review':
          query = query.eq('status', 'needs_review');
          break;
        case 'all':
          break;
      }

      const { data, error } = await query;
      if (error) throw error;
      setBookings((data as BookingRow[]) || []);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, [activeTab, selectedProperty, showAllProperties, today]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const filteredBookings = bookings.filter(
    (b) =>
      b.guests?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.rooms?.room_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const tabs: TabKey[] = ['today', 'upcoming', 'inhouse', 'past', 'cancelled', 'needs_review'];
  if (isAdmin) tabs.push('all');

  return (
    <DashboardLayout title="Bookings">
      <div className="space-y-4 sm:space-y-5">
        {/* Property Badge */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Viewing:</span>
          <PropertyBadge />
        </div>

        {/* Header Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4 sm:justify-between">
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search guest or room..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
          <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-muted/50 p-1 rounded-2xl">
            {tabs.map((tab) => (
              <TabsTrigger key={tab} value={tab} className="text-xs sm:text-sm rounded-xl gap-1.5">
                {TAB_LABELS[tab]}
                {!loading && tab === activeTab && filteredBookings.length > 0 && (
                  <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px] rounded-full">
                    {filteredBookings.length}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {tabs.map((tab) => (
            <TabsContent key={tab} value={tab}>
              <Card>
                <CardContent className="px-3 sm:px-6 pt-4 sm:pt-6">
                  <BookingTable
                    bookings={filteredBookings}
                    loading={loading}
                    onActionComplete={fetchBookings}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

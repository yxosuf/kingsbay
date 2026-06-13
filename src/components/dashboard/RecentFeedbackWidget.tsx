import { Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useGuestFeedback } from '@/hooks/useGuestFeedback';
import { useProperty } from '@/hooks/useProperty';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';

interface FeedbackWithGuest {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  guest_name: string;
  room_number: string;
}

function InlineStars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={cn(
            'h-3 w-3',
            s <= rating ? 'fill-warning text-warning' : 'text-muted-foreground/20'
          )}
        />
      ))}
    </div>
  );
}

export function RecentFeedbackWidget() {
  const { selectedProperty, showAllProperties } = useProperty();
  const [recentFeedback, setRecentFeedback] = useState<FeedbackWithGuest[]>([]);
  const [stats, setStats] = useState({ avg: 0, count: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecentFeedback();
  }, [selectedProperty, showAllProperties]);

  const fetchRecentFeedback = async () => {
    try {
      let query = supabase
        .from('guest_feedback')
        .select(`
          id, rating, comment, created_at,
          guests!inner(name),
          bookings!inner(rooms(room_number))
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      if (selectedProperty?.id && !showAllProperties) {
        query = query.eq('property_id', selectedProperty.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      const mapped = (data || []).map((d: any) => ({
        id: d.id,
        rating: d.rating,
        comment: d.comment,
        created_at: d.created_at,
        guest_name: d.guests?.name || 'Guest',
        room_number: d.bookings?.rooms?.room_number || '?',
      }));
      setRecentFeedback(mapped);

      // Calculate stats
      let statsQuery = supabase.from('guest_feedback').select('rating');
      if (selectedProperty?.id && !showAllProperties) {
        statsQuery = statsQuery.eq('property_id', selectedProperty.id);
      }
      const { data: allRatings } = await statsQuery;
      if (allRatings && allRatings.length > 0) {
        const sum = allRatings.reduce((s, r) => s + r.rating, 0);
        setStats({ avg: sum / allRatings.length, count: allRatings.length });
      } else {
        setStats({ avg: 0, count: 0 });
      }
    } catch (e) {
      console.error('Error fetching recent feedback:', e);
      toast.error('Failed to load recent feedback');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Star className="h-4 w-4 text-warning" />
          Guest Feedback
        </CardTitle>
        {stats.count > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-bold text-foreground">{stats.avg.toFixed(1)}</span>
            <Star className="h-4 w-4 fill-warning text-warning" />
            <span className="text-xs text-muted-foreground">({stats.count})</span>
          </div>
        )}
      </CardHeader>
      <CardContent className="px-4 sm:px-6">
        {recentFeedback.length === 0 ? (
          <div className="text-center py-6">
            <Star className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No feedback yet</p>
            <p className="text-xs text-muted-foreground/70">
              Feedback will appear here after guest checkout
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentFeedback.map((fb) => (
              <div
                key={fb.id}
                className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/40 transition-colors"
              >
                <div className="p-1.5 rounded-full bg-warning/10 shrink-0 mt-0.5">
                  <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate">{fb.guest_name}</p>
                    <InlineStars rating={fb.rating} />
                  </div>
                  <p className="text-xs text-muted-foreground">Room {fb.room_number}</p>
                  {fb.comment && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2 italic">
                      "{fb.comment}"
                    </p>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground/70 shrink-0">
                  {format(new Date(fb.created_at), 'MMM d')}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

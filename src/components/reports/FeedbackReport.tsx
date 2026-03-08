import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { format, eachDayOfInterval, parseISO } from 'date-fns';
import { Download, Star, MessageSquare, TrendingUp, BarChart3 } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import { toast } from 'sonner';

interface FeedbackReportProps {
  dateRange: { from: Date; to: Date };
  propertyId: string | null;
  showAllProperties: boolean;
  propertyName: string;
}

interface FeedbackData {
  totalReviews: number;
  averageRating: number;
  responseRate: number;
  checkedOutCount: number;
  ratingDistribution: { rating: string; count: number }[];
  dailyTrend: { date: string; avg: number; count: number }[];
  categoryBreakdown: { category: string; average: number }[];
}

const CATEGORIES = ['Cleanliness', 'Comfort', 'Service', 'Location', 'Value'];

export function FeedbackReport({ dateRange, propertyId, showAllProperties, propertyName }: FeedbackReportProps) {
  const [data, setData] = useState<FeedbackData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [dateRange, propertyId, showAllProperties]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const fromStr = format(dateRange.from, 'yyyy-MM-dd');
      const toStr = format(dateRange.to, 'yyyy-MM-dd');

      // Fetch feedback
      let feedbackQuery = supabase
        .from('guest_feedback')
        .select('*')
        .gte('created_at', `${fromStr}T00:00:00`)
        .lte('created_at', `${toStr}T23:59:59`);

      if (propertyId && !showAllProperties) {
        feedbackQuery = feedbackQuery.eq('property_id', propertyId);
      }

      const { data: feedback, error: fbError } = await feedbackQuery;
      if (fbError) throw fbError;

      // Fetch checked-out bookings count for response rate
      let bookingsQuery = supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'checked_out')
        .gte('checked_out_at', `${fromStr}T00:00:00`)
        .lte('checked_out_at', `${toStr}T23:59:59`);

      if (propertyId && !showAllProperties) {
        bookingsQuery = bookingsQuery.eq('property_id', propertyId);
      }

      const { count: checkedOutCount } = await bookingsQuery;

      const reviews = feedback || [];
      const totalReviews = reviews.length;
      const averageRating = totalReviews > 0
        ? reviews.reduce((sum, f) => sum + f.rating, 0) / totalReviews
        : 0;
      const coCount = checkedOutCount || 0;
      const responseRate = coCount > 0 ? (totalReviews / coCount) * 100 : 0;

      // Rating distribution
      const distMap: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      reviews.forEach((r) => { distMap[r.rating] = (distMap[r.rating] || 0) + 1; });
      const ratingDistribution = [1, 2, 3, 4, 5].map((r) => ({
        rating: `${r} ★`,
        count: distMap[r],
      }));

      // Daily trend
      const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
      const dayMap: Record<string, { sum: number; count: number }> = {};
      days.forEach((d) => { dayMap[format(d, 'yyyy-MM-dd')] = { sum: 0, count: 0 }; });
      reviews.forEach((r) => {
        const day = format(parseISO(r.created_at), 'yyyy-MM-dd');
        if (dayMap[day]) {
          dayMap[day].sum += r.rating;
          dayMap[day].count += 1;
        }
      });
      const dailyTrend = days.map((d) => {
        const key = format(d, 'yyyy-MM-dd');
        const entry = dayMap[key];
        return {
          date: format(d, 'MMM dd'),
          avg: entry.count > 0 ? Number((entry.sum / entry.count).toFixed(2)) : 0,
          count: entry.count,
        };
      });

      // Category breakdown
      const catTotals: Record<string, { sum: number; count: number }> = {};
      CATEGORIES.forEach((c) => { catTotals[c] = { sum: 0, count: 0 }; });
      reviews.forEach((r) => {
        const cats = (r.categories as Record<string, number>) || {};
        CATEGORIES.forEach((c) => {
          if (cats[c] !== undefined) {
            catTotals[c].sum += cats[c];
            catTotals[c].count += 1;
          }
        });
      });
      const categoryBreakdown = CATEGORIES.map((c) => ({
        category: c,
        average: catTotals[c].count > 0
          ? Number((catTotals[c].sum / catTotals[c].count).toFixed(2))
          : 0,
      }));

      setData({
        totalReviews,
        averageRating,
        responseRate,
        checkedOutCount: coCount,
        ratingDistribution,
        dailyTrend,
        categoryBreakdown,
      });
    } catch (e) {
      console.error('Error fetching feedback report:', e);
      toast.error('Failed to load feedback report');
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (!data) return;
    const rows = [
      ['Metric', 'Value'],
      ['Total Reviews', data.totalReviews.toString()],
      ['Average Rating', data.averageRating.toFixed(2)],
      ['Response Rate', `${data.responseRate.toFixed(1)}%`],
      ['Checked-Out Bookings', data.checkedOutCount.toString()],
      [],
      ['Rating', 'Count'],
      ...data.ratingDistribution.map((r) => [r.rating, r.count.toString()]),
      [],
      ['Category', 'Average'],
      ...data.categoryBreakdown.map((c) => [c.category, c.average.toString()]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `feedback-report-${format(dateRange.from, 'yyyy-MM-dd')}-to-${format(dateRange.to, 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="pt-5"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
        <Card><CardContent className="pt-5"><Skeleton className="h-64 w-full" /></CardContent></Card>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-5">
      {/* Header with export */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {propertyName} · {format(dateRange.from, 'MMM dd')} – {format(dateRange.to, 'MMM dd, yyyy')}
        </p>
        <Button variant="outline" size="sm" className="rounded-xl" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10"><MessageSquare className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Total Reviews</p>
                <p className="text-2xl font-bold">{data.totalReviews}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-warning/10"><Star className="h-5 w-5 text-warning" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Rating</p>
                <p className="text-2xl font-bold">{data.averageRating.toFixed(1)} <span className="text-sm text-muted-foreground">/ 5</span></p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-success/10"><TrendingUp className="h-5 w-5 text-success" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Response Rate</p>
                <p className="text-2xl font-bold">{data.responseRate.toFixed(1)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-muted"><BarChart3 className="h-5 w-5 text-muted-foreground" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Checked-Out</p>
                <p className="text-2xl font-bold">{data.checkedOutCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rating Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Rating Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {data.dailyTrend.some((d) => d.count > 0) ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.dailyTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis domain={[0, 5]} className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0.75rem',
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === 'avg') return [value.toFixed(2), 'Avg Rating'];
                    return [value, 'Reviews'];
                  }}
                />
                <Line type="monotone" dataKey="avg" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} connectNulls />
                <Bar dataKey="count" fill="hsl(var(--primary) / 0.15)" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-muted-foreground py-12">No feedback data in this period</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Rating Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Rating Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.ratingDistribution} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis dataKey="rating" type="category" width={50} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0.75rem',
                  }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Category Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {data.categoryBreakdown.some((c) => c.average > 0) ? (
              <ResponsiveContainer width="100%" height={250}>
                <RadarChart data={data.categoryBreakdown}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="category" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <PolarRadiusAxis domain={[0, 5]} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Radar dataKey="average" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" fillOpacity={0.6} />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-12">No category data available</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

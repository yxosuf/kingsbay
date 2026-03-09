import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { format, eachDayOfInterval, differenceInDays, parseISO } from 'date-fns';
import { Download, BedDouble, Users, TrendingUp, CalendarDays } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { toast } from 'sonner';

interface OccupancyReportProps {
  dateRange: { from: Date; to: Date };
  propertyId: string | null;
  showAllProperties: boolean;
  propertyName: string;
}

interface OccupancyData {
  totalRooms: number;
  totalNights: number;
  occupiedNights: number;
  occupancyRate: number;
  avgStayLength: number;
  totalBookings: number;
  activeStays: number;
  completedStays: number;
  dailyOccupancy: { date: string; occupied: number; available: number; rate: number }[];
  byRoomType: Record<string, { occupied: number; total: number }>;
}

export function OccupancyReport({ dateRange, propertyId, showAllProperties, propertyName }: OccupancyReportProps) {
  const [data, setData] = useState<OccupancyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [dateRange, propertyId, showAllProperties]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const fromDate = format(dateRange.from, 'yyyy-MM-dd');
      const toDate = format(dateRange.to, 'yyyy-MM-dd');

      // Fetch rooms
      let roomsQuery = supabase.from('rooms').select('id, room_type, property_id').neq('status', 'maintenance');
      if (propertyId && !showAllProperties) {
        roomsQuery = roomsQuery.eq('property_id', propertyId);
      }
      const { data: rooms } = await roomsQuery;
      const totalRooms = rooms?.length || 0;

      // Fetch bookings that overlap with date range using [check_in, check_out)
      let bookingsQuery = supabase
        .from('bookings')
        .select('id, room_id, check_in, check_out, status, property_id')
        .lt('check_in', toDate)   // check_in < range end (toDate is inclusive, so we go to next day conceptually)
        .gt('check_out', fromDate) // check_out > range start
        .not('status', 'in', '("cancelled","no_show","archived")');
      if (propertyId && !showAllProperties) {
        bookingsQuery = bookingsQuery.eq('property_id', propertyId);
      }
      const { data: bookings } = await bookingsQuery;

      // Calculate daily occupancy using [check_in, check_out) logic
      const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
      const roomIds = new Set(rooms?.map(r => r.id) || []);

      const dailyOccupancy = days.map(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const occupiedRooms = new Set<string>();

        bookings?.forEach(b => {
          // Block if: date >= check_in AND date < check_out
          if (roomIds.has(b.room_id) && dayStr >= b.check_in && dayStr < b.check_out) {
            if (['confirmed', 'checked_in', 'pending', 'needs_review'].includes(b.status)) {
              occupiedRooms.add(b.room_id);
            }
          }
        });

        const occupied = occupiedRooms.size;
        const available = totalRooms - occupied;
        const rate = totalRooms > 0 ? Math.round((occupied / totalRooms) * 100) : 0;

        return {
          date: format(day, 'MMM d'),
          occupied,
          available,
          rate,
        };
      });

      const totalNights = days.length * totalRooms;
      const occupiedNights = dailyOccupancy.reduce((s, d) => s + d.occupied, 0);
      const occupancyRate = totalNights > 0 ? Math.round((occupiedNights / totalNights) * 100) : 0;

      // Calculate average stay length
      const stayLengths = bookings?.map(b => {
        const ci = parseISO(b.check_in);
        const co = parseISO(b.check_out);
        return differenceInDays(co, ci);
      }) || [];
      const avgStayLength = stayLengths.length > 0
        ? Math.round((stayLengths.reduce((s, l) => s + l, 0) / stayLengths.length) * 10) / 10
        : 0;

      // By room type
      const byRoomType: Record<string, { occupied: number; total: number }> = {};
      rooms?.forEach(r => {
        if (!byRoomType[r.room_type]) {
          byRoomType[r.room_type] = { occupied: 0, total: 0 };
        }
        byRoomType[r.room_type].total++;
      });

      // Count occupied nights per room type
      bookings?.forEach(b => {
        const room = rooms?.find(r => r.id === b.room_id);
        if (room && byRoomType[room.room_type]) {
          const ci = parseISO(b.check_in);
          const co = parseISO(b.check_out);
          const nights = differenceInDays(co, ci);
          byRoomType[room.room_type].occupied += nights;
        }
      });

      setData({
        totalRooms,
        totalNights,
        occupiedNights,
        occupancyRate,
        avgStayLength,
        totalBookings: bookings?.length || 0,
        activeStays: bookings?.filter(b => b.status === 'checked_in').length || 0,
        completedStays: bookings?.filter(b => b.status === 'checked_out').length || 0,
        dailyOccupancy,
        byRoomType,
      });
    } catch (err) {
      console.error('Occupancy report error:', err);
      toast.error('Failed to load occupancy data');
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (!data) return;
    const lines = [
      `Occupancy Report - ${propertyName}`,
      `Period: ${format(dateRange.from, 'PP')} - ${format(dateRange.to, 'PP')}`,
      '',
      'Metric,Value',
      `Total Rooms,${data.totalRooms}`,
      `Occupancy Rate,${data.occupancyRate}%`,
      `Total Room-Nights,${data.totalNights}`,
      `Occupied Room-Nights,${data.occupiedNights}`,
      `Average Stay Length,${data.avgStayLength} nights`,
      `Total Bookings,${data.totalBookings}`,
      `Active Stays,${data.activeStays}`,
      `Completed Stays,${data.completedStays}`,
      '',
      'Room Type,Occupied Nights,Total Rooms',
      ...Object.entries(data.byRoomType).map(([type, d]) => `${type},${d.occupied},${d.total}`),
      '',
      'Date,Occupied,Available,Rate %',
      ...data.dailyOccupancy.map(d => `${d.date},${d.occupied},${d.available},${d.rate}`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Occupancy_Report_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Occupancy report exported');
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}><CardContent className="pt-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
        <Card><CardContent className="pt-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
      </div>
    );
  }

  if (!data) return null;

  const getOccupancyColor = (rate: number) => {
    if (rate >= 80) return 'text-success';
    if (rate >= 50) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Occupancy Analytics</h2>
        <Button variant="outline" onClick={exportCSV} disabled={!data}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard colorVariant="primary">
          <div className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Occupancy Rate</p>
                <p className={`text-2xl font-bold ${getOccupancyColor(data.occupancyRate)}`}>
                  {data.occupancyRate}%
                </p>
              </div>
            </div>
          </div>
        </KpiCard>
        <KpiCard colorVariant="info">
          <div className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-info/10">
                <BedDouble className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Rooms</p>
                <p className="text-2xl font-bold">{data.totalRooms}</p>
              </div>
            </div>
          </div>
        </KpiCard>
        <KpiCard colorVariant="success">
          <div className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-success/10">
                <CalendarDays className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg Stay</p>
                <p className="text-2xl font-bold">{data.avgStayLength} <span className="text-sm font-normal text-muted-foreground">nights</span></p>
              </div>
            </div>
          </div>
        </KpiCard>
        <KpiCard colorVariant="warning">
          <div className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-warning/10">
                <Users className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Bookings</p>
                <p className="text-2xl font-bold">{data.totalBookings}</p>
              </div>
            </div>
          </div>
        </KpiCard>
      </div>

      {/* Room-Night Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-xs text-muted-foreground">Total Room-Nights</p>
            <p className="text-2xl font-bold">{data.totalNights.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-xs text-muted-foreground">Occupied Room-Nights</p>
            <p className="text-2xl font-bold text-success">{data.occupiedNights.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-xs text-muted-foreground">Available Room-Nights</p>
            <p className="text-2xl font-bold text-muted-foreground">{(data.totalNights - data.occupiedNights).toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Occupancy Area Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daily Occupancy Rate</CardTitle>
        </CardHeader>
        <CardContent>
          {data.dailyOccupancy.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data.dailyOccupancy}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(35, 20%, 82%)" />
                <XAxis dataKey="date" fontSize={11} tick={{ fill: 'hsl(25, 10%, 45%)' }} />
                <YAxis fontSize={11} tick={{ fill: 'hsl(25, 10%, 45%)' }} domain={[0, 100]} tickFormatter={v => `${v}%`} />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === 'rate') return [`${value}%`, 'Occupancy'];
                    return [value, name];
                  }}
                  contentStyle={{ backgroundColor: 'hsl(40, 25%, 98%)', border: '1px solid hsl(35, 20%, 82%)', borderRadius: '8px' }}
                />
                <Area type="monotone" dataKey="rate" stroke="hsl(25, 100%, 8%)" fill="hsl(25, 100%, 8%)" fillOpacity={0.15} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-muted-foreground py-12">No data for this period</p>
          )}
        </CardContent>
      </Card>

      {/* By Room Type */}
      {Object.keys(data.byRoomType).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Occupancy by Room Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(data.byRoomType).map(([type, d]) => {
                const periodDays = differenceInDays(dateRange.to, dateRange.from) + 1;
                const maxNights = d.total * periodDays;
                const typeRate = maxNights > 0 ? Math.round((d.occupied / maxNights) * 100) : 0;
                return (
                  <div key={type} className="p-4 rounded-lg bg-muted/50 text-center">
                    <p className="text-xs text-muted-foreground capitalize mb-1">{type}</p>
                    <p className={`text-xl font-bold ${getOccupancyColor(typeRate)}`}>{typeRate}%</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{d.occupied} / {maxNights} nights</p>
                    <Badge variant="outline" className="mt-2 text-[10px]">{d.total} rooms</Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

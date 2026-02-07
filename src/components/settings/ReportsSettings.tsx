import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarIcon, Download, TrendingUp, Users, BedDouble, Wallet, FileSpreadsheet } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Separator } from '@/components/ui/separator';

export function ReportsSettings() {
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);

  const generateReport = async (reportType: string) => {
    setLoading(true);
    try {
      const fromDate = format(dateRange.from, 'yyyy-MM-dd');
      const toDate = format(dateRange.to, 'yyyy-MM-dd');

      let data: any = {};

      if (reportType === 'revenue') {
        const { data: payments } = await supabase
          .from('payments')
          .select('amount, method, created_at')
          .gte('created_at', fromDate)
          .lte('created_at', toDate);

        const totalRevenue = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
        const byMethod = payments?.reduce((acc: any, p) => {
          acc[p.method] = (acc[p.method] || 0) + Number(p.amount);
          return acc;
        }, {});

        data = {
          type: 'Revenue Report',
          period: `${format(dateRange.from, 'PP')} - ${format(dateRange.to, 'PP')}`,
          totalRevenue,
          byMethod,
          transactionCount: payments?.length || 0,
        };
      } else if (reportType === 'occupancy') {
        const { data: bookings } = await supabase
          .from('bookings')
          .select('status, check_in, check_out')
          .gte('check_in', fromDate)
          .lte('check_out', toDate);

        const { count: totalRooms } = await supabase
          .from('rooms')
          .select('*', { count: 'exact', head: true });

        data = {
          type: 'Occupancy Report',
          period: `${format(dateRange.from, 'PP')} - ${format(dateRange.to, 'PP')}`,
          totalRooms: totalRooms || 0,
          totalBookings: bookings?.length || 0,
          completedStays: bookings?.filter((b) => b.status === 'checked_out').length || 0,
          activeStays: bookings?.filter((b) => b.status === 'checked_in').length || 0,
        };
      } else if (reportType === 'guests') {
        const { data: guests } = await supabase
          .from('guests')
          .select('id, name, created_at')
          .gte('created_at', fromDate)
          .lte('created_at', toDate);

        const { count: totalGuests } = await supabase
          .from('guests')
          .select('*', { count: 'exact', head: true });

        data = {
          type: 'Guest Report',
          period: `${format(dateRange.from, 'PP')} - ${format(dateRange.to, 'PP')}`,
          newGuests: guests?.length || 0,
          totalGuests: totalGuests || 0,
        };
      }

      setReportData(data);
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!reportData) return;

    let csvContent = `${reportData.type}\n`;
    csvContent += `Period: ${reportData.period}\n\n`;

    Object.entries(reportData).forEach(([key, value]) => {
      if (key !== 'type' && key !== 'period') {
        if (typeof value === 'object') {
          csvContent += `\n${key}:\n`;
          Object.entries(value as object).forEach(([k, v]) => {
            csvContent += `${k},${v}\n`;
          });
        } else {
          csvContent += `${key},${value}\n`;
        }
      }
    });

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportData.type.replace(' ', '_')}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Report exported successfully');
  };

  const exportFullGuestDetails = async () => {
    setLoading(true);
    try {
      // Fetch all guests with their booking stats
      const { data: guests, error: guestsError } = await supabase
        .from('guests')
        .select(`
          id,
          name,
          phone,
          email,
          nationality,
          id_passport,
          address,
          notes,
          created_at
        `)
        .order('name');

      if (guestsError) throw guestsError;

      // Fetch booking counts and dates for each guest
      const guestStats = await Promise.all(
        (guests || []).map(async (guest) => {
          const { data: bookings } = await supabase
            .from('bookings')
            .select('id, check_in, check_out, total_amount')
            .eq('guest_id', guest.id)
            .order('check_out', { ascending: false });

          const bookingIds = (bookings || []).map(b => b.id).filter(Boolean);
          const { data: services } = bookingIds.length > 0
            ? await supabase
                .from('guest_services')
                .select('total_price, booking_id')
                .in('booking_id', bookingIds)
            : { data: [] };

          const totalServices = (services || []).reduce((sum, s) => sum + Number(s.total_price), 0);
          const lastBooking = bookings?.[0];

          return {
            ...guest,
            total_bookings: bookings?.length || 0,
            last_checkin: lastBooking?.check_in || '',
            last_checkout: lastBooking?.check_out || '',
            total_services_value: totalServices,
          };
        })
      );

      // Generate CSV
      const headers = [
        'Guest ID',
        'Full Name',
        'Phone',
        'Email',
        'Country',
        'Passport/ID',
        'Address',
        'Notes',
        'Total Bookings',
        'Last Check-in',
        'Last Check-out',
        'Total Services Value',
      ];

      let csvContent = headers.join(',') + '\n';

      guestStats.forEach((guest) => {
        const row = [
          guest.id,
          `"${(guest.name || '').replace(/"/g, '""')}"`,
          guest.phone || '',
          guest.email || '',
          guest.nationality || '',
          guest.id_passport || '',
          `"${(guest.address || '').replace(/"/g, '""')}"`,
          `"${(guest.notes || '').replace(/"/g, '""')}"`,
          guest.total_bookings,
          guest.last_checkin,
          guest.last_checkout,
          guest.total_services_value,
        ];
        csvContent += row.join(',') + '\n';
      });

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Guest_Details_Full_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Full guest details exported successfully');
    } catch (error) {
      console.error('Error exporting guest details:', error);
      toast.error('Failed to export guest details');
    } finally {
      setLoading(false);
    }
  };

  const exportGuestServicesReport = async () => {
    setLoading(true);
    try {
      const { data: services, error } = await supabase
        .from('guest_services')
        .select(`
          id,
          quantity,
          unit_price,
          total_price,
          service_date,
          notes,
          services (name),
          bookings (
            id,
            check_in,
            guests (name)
          )
        `)
        .order('service_date', { ascending: false });

      if (error) throw error;

      const headers = [
        'Guest Name',
        'Booking ID',
        'Booking Check-in',
        'Service Name',
        'Quantity',
        'Unit Price',
        'Total Price',
        'Date Purchased',
        'Notes',
      ];

      let csvContent = headers.join(',') + '\n';

      (services || []).forEach((service: any) => {
        const row = [
          `"${(service.bookings?.guests?.name || '').replace(/"/g, '""')}"`,
          service.bookings?.id || '',
          service.bookings?.check_in || '',
          `"${(service.services?.name || '').replace(/"/g, '""')}"`,
          service.quantity,
          service.unit_price,
          service.total_price,
          service.service_date,
          `"${(service.notes || '').replace(/"/g, '""')}"`,
        ];
        csvContent += row.join(',') + '\n';
      });

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Guest_Services_Report_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Guest services report exported successfully');
    } catch (error) {
      console.error('Error exporting services report:', error);
      toast.error('Failed to export services report');
    } finally {
      setLoading(false);
    }
  };

  const quickDateRanges = [
    { label: 'Today', value: () => ({ from: new Date(), to: new Date() }) },
    {
      label: 'Last 7 days',
      value: () => ({ from: subDays(new Date(), 7), to: new Date() }),
    },
    {
      label: 'Last 30 days',
      value: () => ({ from: subDays(new Date(), 30), to: new Date() }),
    },
    {
      label: 'This Month',
      value: () => ({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date()),
      }),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Date Range Selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-wrap gap-2">
              {quickDateRanges.map((range) => (
                <Button
                  key={range.label}
                  variant="outline"
                  size="sm"
                  onClick={() => setDateRange(range.value())}
                >
                  {range.label}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[140px]">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateRange.from, 'PP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateRange.from}
                    onSelect={(date) => date && setDateRange({ ...dateRange, from: date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <span className="self-center text-muted-foreground">to</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[140px]">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateRange.to, 'PP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateRange.to}
                    onSelect={(date) => date && setDateRange({ ...dateRange, to: date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Types */}
      <Tabs defaultValue="revenue">
        <TabsList>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="occupancy">Occupancy</TabsTrigger>
          <TabsTrigger value="guests">Guests</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="mt-6 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Revenue Report</h2>
            <div className="flex gap-2">
              <Button onClick={() => generateReport('revenue')} disabled={loading}>
                {loading ? 'Generating...' : 'Generate Report'}
              </Button>
              {reportData && reportData.type === 'Revenue Report' && (
                <Button variant="outline" onClick={exportToCSV}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              )}
            </div>
          </div>

          {reportData && reportData.type === 'Revenue Report' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-success/10">
                      <Wallet className="h-6 w-6 text-success" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Revenue</p>
                      <p className="text-2xl font-bold">
                        Rs. {reportData.totalRevenue.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-info/10">
                      <TrendingUp className="h-6 w-6 text-info" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Transactions</p>
                      <p className="text-2xl font-bold">{reportData.transactionCount}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">By Payment Method</CardTitle>
                </CardHeader>
                <CardContent>
                  {reportData.byMethod &&
                    Object.entries(reportData.byMethod).map(([method, amount]) => (
                      <div key={method} className="flex justify-between py-1">
                        <span className="capitalize text-muted-foreground">{method}</span>
                        <span className="font-medium">
                          Rs. {(amount as number).toLocaleString()}
                        </span>
                      </div>
                    ))}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="occupancy" className="mt-6 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Occupancy Report</h2>
            <div className="flex gap-2">
              <Button onClick={() => generateReport('occupancy')} disabled={loading}>
                {loading ? 'Generating...' : 'Generate Report'}
              </Button>
              {reportData && reportData.type === 'Occupancy Report' && (
                <Button variant="outline" onClick={exportToCSV}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              )}
            </div>
          </div>

          {reportData && reportData.type === 'Occupancy Report' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-primary/10">
                      <BedDouble className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Rooms</p>
                      <p className="text-2xl font-bold">{reportData.totalRooms}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Total Bookings</p>
                  <p className="text-2xl font-bold">{reportData.totalBookings}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Completed Stays</p>
                  <p className="text-2xl font-bold">{reportData.completedStays}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">Active Stays</p>
                  <p className="text-2xl font-bold">{reportData.activeStays}</p>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="guests" className="mt-6 space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Guest Report</h2>
            <div className="flex gap-2">
              <Button onClick={() => generateReport('guests')} disabled={loading}>
                {loading ? 'Generating...' : 'Generate Report'}
              </Button>
              {reportData && reportData.type === 'Guest Report' && (
                <Button variant="outline" onClick={exportToCSV}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              )}
            </div>
          </div>

          {reportData && reportData.type === 'Guest Report' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-warning/10">
                      <Users className="h-6 w-6 text-warning" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">New Guests</p>
                      <p className="text-2xl font-bold">{reportData.newGuests}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-info/10">
                      <Users className="h-6 w-6 text-info" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Guests (All Time)</p>
                      <p className="text-2xl font-bold">{reportData.totalGuests}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Export Options */}
          <Separator />
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Export Options
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  variant="outline" 
                  onClick={exportFullGuestDetails}
                  disabled={loading}
                  className="flex-1"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Full Guest Details
                </Button>
                <Button 
                  variant="outline" 
                  onClick={exportGuestServicesReport}
                  disabled={loading}
                  className="flex-1"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Guest Services Report
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Full Guest Details: Includes all guest information (name, contact, address, passport, notes, booking stats).
                <br />
                Guest Services Report: Detailed breakdown of all services purchased per guest/booking.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

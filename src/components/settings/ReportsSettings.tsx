import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Download, FileSpreadsheet, AlertTriangle, BarChart3, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useProperty } from '@/hooks/useProperty';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export function ReportsSettings() {
  const navigate = useNavigate();
  const { selectedProperty, showAllProperties } = useProperty();
  const [loading, setLoading] = useState(false);

  const exportFullGuestDetails = async () => {
    setLoading(true);
    try {
      const propertyFilter = !showAllProperties && selectedProperty?.id;

      const { data: guests, error: guestsError } = await supabase
        .from('guests')
        .select('id, name, phone, email, nationality, id_passport, address, notes, created_at')
        .order('name');

      if (guestsError) throw guestsError;

      const guestStats = await Promise.all(
        (guests || []).map(async (guest) => {
          let bookingsQuery = supabase
            .from('bookings')
            .select('id, check_in, check_out, total_amount, property_id')
            .eq('guest_id', guest.id)
            .order('check_out', { ascending: false });

          if (propertyFilter) {
            bookingsQuery = bookingsQuery.eq('property_id', selectedProperty!.id);
          }

          const { data: bookings } = await bookingsQuery;
          const bookingIds = (bookings || []).map(b => b.id);
          let servicesData: { total_price: number }[] = [];

          if (bookingIds.length > 0) {
            let servicesQuery = supabase
              .from('guest_services')
              .select('total_price')
              .in('booking_id', bookingIds);
            if (propertyFilter) {
              servicesQuery = servicesQuery.eq('property_id', selectedProperty!.id);
            }
            const { data } = await servicesQuery;
            servicesData = (data as any) || [];
          }

          const totalServices = servicesData.reduce((sum, s) => sum + Number(s.total_price), 0);
          const lastBooking = bookings?.[0];

          return {
            ...guest,
            total_bookings: bookings?.length || 0,
            last_checkin: lastBooking?.check_in || '',
            last_checkout: lastBooking?.check_out || '',
            total_services_value: totalServices,
            hasPropertyBookings: (bookings?.length || 0) > 0,
          };
        })
      );

      const filteredGuestStats = propertyFilter
        ? guestStats.filter(g => g.hasPropertyBookings)
        : guestStats;

      const headers = ['Guest ID', 'Full Name', 'Phone', 'Email', 'Country', 'Passport/ID', 'Address', 'Notes', 'Total Bookings', 'Last Check-in', 'Last Check-out', 'Total Services Value'];

      let csvContent = `Property: ${showAllProperties ? 'All Properties' : selectedProperty?.name || 'Unknown'}\n\n`;
      csvContent += headers.join(',') + '\n';

      filteredGuestStats.forEach((guest) => {
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
      a.download = `Guest_Details_${selectedProperty?.name?.replace(/\s+/g, '_') || 'All'}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Full guest details exported');
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
      const propertyFilter = !showAllProperties && selectedProperty?.id;

      let query = supabase
        .from('guest_services')
        .select(`
          id, quantity, unit_price, total_price, service_date, notes, property_id,
          services (name),
          bookings (id, check_in, property_id, guests (name))
        `)
        .order('service_date', { ascending: false });

      if (propertyFilter) {
        query = query.eq('property_id', selectedProperty!.id);
      }

      const { data: services, error } = await query;
      if (error) throw error;

      const headers = ['Guest Name', 'Booking ID', 'Booking Check-in', 'Service Name', 'Quantity', 'Unit Price', 'Total Price', 'Date Purchased', 'Notes'];

      let csvContent = `Property: ${showAllProperties ? 'All Properties' : selectedProperty?.name || 'Unknown'}\n\n`;
      csvContent += headers.join(',') + '\n';

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
      a.download = `Guest_Services_${selectedProperty?.name?.replace(/\s+/g, '_') || 'All'}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Guest services report exported');
    } catch (error) {
      console.error('Error exporting services report:', error);
      toast.error('Failed to export services report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Property Indicator */}
      <Alert className="border-info bg-info/10">
        <AlertTriangle className="h-4 w-4 text-info" />
        <AlertTitle className="text-info">Report Scope</AlertTitle>
        <AlertDescription>
          Reports are filtered by: <strong>{showAllProperties ? 'All Properties' : selectedProperty?.name || 'No property selected'}</strong>.
          Change the property in the header to generate reports for a different property.
        </AlertDescription>
      </Alert>

      {/* Live Reports Link */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Live Reports & Analytics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            View interactive revenue, occupancy, and financial reports with charts, KPIs, and ledger reconciliation.
          </p>
          <Button onClick={() => navigate('/reports')}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Open Reports Dashboard
          </Button>
        </CardContent>
      </Card>

      {/* Data Export Options */}
      <Separator />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Data Exports
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
    </div>
  );
}

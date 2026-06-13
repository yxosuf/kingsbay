import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Download, FileSpreadsheet, BarChart3, ExternalLink, FileText, Users, ShoppingBag } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useProperty } from '@/hooks/useProperty';
import { toast } from 'sonner';
import { downloadCsv, buildCsvFilename } from '@/lib/exportUtils';
import { useNavigate } from 'react-router-dom';
import { PropertyBadge } from '@/components/layout/PropertyBadge';
import { cn } from '@/lib/utils';

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

      downloadCsv(csvContent, buildCsvFilename(`Guest_Details_${selectedProperty?.name?.replace(/\s+/g, '_') || 'All'}`), 'Full guest details exported');
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

      downloadCsv(csvContent, buildCsvFilename(`Guest_Services_${selectedProperty?.name?.replace(/\s+/g, '_') || 'All'}`), 'Guest services report exported');
    } catch (error) {
      console.error('Error exporting services report:', error);
      toast.error('Failed to export services report');
    } finally {
      setLoading(false);
    }
  };

  const exportCards = [
    {
      title: 'Full Guest Details',
      description: 'All guest information including name, contact, address, passport, notes, and booking stats.',
      icon: Users,
      color: 'text-info',
      bg: 'bg-info/10',
      border: 'border-info/20',
      action: exportFullGuestDetails,
    },
    {
      title: 'Guest Services Report',
      description: 'Detailed breakdown of all services purchased per guest and booking.',
      icon: ShoppingBag,
      color: 'text-success',
      bg: 'bg-success/10',
      border: 'border-success/20',
      action: exportGuestServicesReport,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Reports & Exports</h3>
            <p className="text-sm text-muted-foreground">View analytics and export data</p>
          </div>
        </div>
        <PropertyBadge />
      </div>

      {/* Live Reports Link Card */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent overflow-hidden">
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold">Live Reports & Analytics</h4>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Interactive revenue, occupancy, and financial reports with charts and KPIs
                </p>
              </div>
            </div>
            <Button onClick={() => navigate('/reports')} className="shrink-0">
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Reports
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Data Exports */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
          <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Data Exports</h4>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {exportCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.title} className={cn("border", card.border, "hover:shadow-sm transition-shadow")}>
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className={cn("p-2.5 rounded-xl shrink-0", card.bg)}>
                      <Icon className={cn("h-5 w-5", card.color)} />
                    </div>
                    <div>
                      <h4 className="font-medium">{card.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{card.description}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={card.action}
                    disabled={loading}
                    className="w-full"
                    size="sm"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {loading ? 'Exporting...' : 'Export CSV'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarIcon } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { PropertyBadge } from '@/components/layout/PropertyBadge';
import { useProperty } from '@/hooks/useProperty';
import { RevenueReport } from '@/components/reports/RevenueReport';
import { OccupancyReport } from '@/components/reports/OccupancyReport';
import { FinancialSummary } from '@/components/reports/FinancialSummary';

export default function Reports() {
  const { selectedProperty, showAllProperties } = useProperty();
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  const propertyId = selectedProperty?.id || null;
  const propertyName = showAllProperties ? 'All Properties' : selectedProperty?.name || 'No property';

  const quickDateRanges = [
    { label: 'Today', value: () => ({ from: new Date(), to: new Date() }) },
    { label: 'Last 7 days', value: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
    { label: 'Last 30 days', value: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
    { label: 'This Month', value: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
  ];

  return (
    <DashboardLayout title="Reports">
      <div className="space-y-6">
        {/* Property Badge */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Viewing:</span>
          <PropertyBadge />
        </div>

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

        {/* Report Tabs */}
        <Tabs defaultValue="revenue">
          <TabsList>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="occupancy">Occupancy</TabsTrigger>
            <TabsTrigger value="financial">Financial</TabsTrigger>
          </TabsList>

          <TabsContent value="revenue" className="mt-6">
            <RevenueReport
              dateRange={dateRange}
              propertyId={propertyId}
              showAllProperties={showAllProperties}
              propertyName={propertyName}
            />
          </TabsContent>

          <TabsContent value="occupancy" className="mt-6">
            <OccupancyReport
              dateRange={dateRange}
              propertyId={propertyId}
              showAllProperties={showAllProperties}
              propertyName={propertyName}
            />
          </TabsContent>

          <TabsContent value="financial" className="mt-6">
            <FinancialSummary
              dateRange={dateRange}
              propertyId={propertyId}
              showAllProperties={showAllProperties}
              propertyName={propertyName}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

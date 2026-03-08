import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarIcon, ArrowRight } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { PropertyBadge } from '@/components/layout/PropertyBadge';
import { useProperty } from '@/hooks/useProperty';
import { RevenueReport } from '@/components/reports/RevenueReport';
import { OccupancyReport } from '@/components/reports/OccupancyReport';
import { FinancialSummary } from '@/components/reports/FinancialSummary';
import { FeedbackReport } from '@/components/reports/FeedbackReport';
import { cn } from '@/lib/utils';

export default function Reports() {
  const { selectedProperty, showAllProperties } = useProperty();
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [activeQuickRange, setActiveQuickRange] = useState<string>('This Month');

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
      <div className="space-y-5">
        {/* Property Badge */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Viewing:</span>
          <PropertyBadge />
        </div>

        {/* Date Range Selector */}
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex flex-wrap gap-2">
                {quickDateRanges.map((range) => (
                  <Button
                    key={range.label}
                    variant={activeQuickRange === range.label ? 'default' : 'outline'}
                    size="sm"
                    className="rounded-xl"
                    onClick={() => {
                      setDateRange(range.value());
                      setActiveQuickRange(range.label);
                    }}
                  >
                    {range.label}
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[140px] rounded-xl">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(dateRange.from, 'PP')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateRange.from}
                      onSelect={(date) => { date && setDateRange({ ...dateRange, from: date }); setActiveQuickRange(''); }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[140px] rounded-xl">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(dateRange.to, 'PP')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dateRange.to}
                      onSelect={(date) => { date && setDateRange({ ...dateRange, to: date }); setActiveQuickRange(''); }}
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
          <TabsList className="bg-muted/50 p-1 rounded-2xl">
            <TabsTrigger value="revenue" className="rounded-xl">Revenue</TabsTrigger>
            <TabsTrigger value="occupancy" className="rounded-xl">Occupancy</TabsTrigger>
            <TabsTrigger value="financial" className="rounded-xl">Financial</TabsTrigger>
            <TabsTrigger value="feedback" className="rounded-xl">Feedback</TabsTrigger>
          </TabsList>

          <TabsContent value="revenue" className="mt-5">
            <RevenueReport dateRange={dateRange} propertyId={propertyId} showAllProperties={showAllProperties} propertyName={propertyName} />
          </TabsContent>
          <TabsContent value="occupancy" className="mt-5">
            <OccupancyReport dateRange={dateRange} propertyId={propertyId} showAllProperties={showAllProperties} propertyName={propertyName} />
          </TabsContent>
          <TabsContent value="financial" className="mt-5">
            <FinancialSummary dateRange={dateRange} propertyId={propertyId} showAllProperties={showAllProperties} propertyName={propertyName} />
          </TabsContent>
          <TabsContent value="feedback" className="mt-5">
            <FeedbackReport dateRange={dateRange} propertyId={propertyId} showAllProperties={showAllProperties} propertyName={propertyName} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

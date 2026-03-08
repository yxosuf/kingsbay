import { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Lock, Edit3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useProperty } from '@/hooks/useProperty';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { toDateString, parseLocalDate } from '@/lib/dateUtils';
import { fetchRateData, fetchOverrides, calculateNightRate, type NightBreakdown } from '@/lib/rateEngine';
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

export default function RateCalendar() {
  const { selectedProperty } = useProperty();
  const { isAdmin } = useAuth();
  const propertyId = selectedProperty?.id;

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [roomTypes, setRoomTypes] = useState<string[]>([]);
  const [selectedRoomType, setSelectedRoomType] = useState<string>('');
  const [rateData, setRateData] = useState<any>(null);
  const [overrides, setOverrides] = useState<Map<string, any>>(new Map());
  const [roomBasePrice, setRoomBasePrice] = useState(0);
  const [loading, setLoading] = useState(true);

  // Override dialog
  const [showOverride, setShowOverride] = useState(false);
  const [overrideDate, setOverrideDate] = useState('');
  const [overridePrice, setOverridePrice] = useState('');
  const [overrideClosed, setOverrideClosed] = useState(false);

  // Fetch room types
  useEffect(() => {
    if (!propertyId) return;
    const fetch = async () => {
      const { data } = await supabase
        .from('rooms')
        .select('room_type, price')
        .eq('property_id', propertyId);
      const types = [...new Set((data || []).map(r => r.room_type))];
      setRoomTypes(types);
      if (types.length > 0 && !selectedRoomType) {
        setSelectedRoomType(types[0]);
        const avgPrice = (data || []).filter(r => r.room_type === types[0]).reduce((s, r) => s + r.price, 0) / (data || []).filter(r => r.room_type === types[0]).length;
        setRoomBasePrice(avgPrice || 0);
      }
    };
    fetch();
  }, [propertyId]);

  // Update base price when room type changes
  useEffect(() => {
    if (!propertyId || !selectedRoomType) return;
    const fetch = async () => {
      const { data } = await supabase.from('rooms').select('price').eq('property_id', propertyId).eq('room_type', selectedRoomType);
      const avg = (data || []).reduce((s, r) => s + r.price, 0) / Math.max((data || []).length, 1);
      setRoomBasePrice(avg);
    };
    fetch();
  }, [selectedRoomType, propertyId]);

  // Fetch rate data
  useEffect(() => {
    if (!propertyId) return;
    setLoading(true);
    const load = async () => {
      const rd = await fetchRateData(propertyId);
      setRateData(rd);

      const monthStart = toDateString(startOfMonth(currentMonth));
      const monthEnd = toDateString(endOfMonth(currentMonth));
      const ov = await fetchOverrides(propertyId, selectedRoomType, monthStart, monthEnd);
      setOverrides(ov);
      setLoading(false);
    };
    load();
  }, [propertyId, currentMonth, selectedRoomType]);

  // Generate dates for the month
  const dates = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Calculate rates for each date
  const nightRates = useMemo(() => {
    if (!rateData) return [];
    return dates.map(d => {
      const dateStr = toDateString(d);
      return calculateNightRate(
        dateStr, roomBasePrice, selectedRoomType,
        null, rateData.roomTypeOverrides, rateData.seasonalRules, rateData.dayOfWeekRules,
        overrides, 2
      );
    });
  }, [dates, rateData, roomBasePrice, selectedRoomType, overrides]);

  const openOverrideDialog = (dateStr: string, currentPrice: number) => {
    setOverrideDate(dateStr);
    const existing = overrides.get(dateStr);
    setOverridePrice(existing ? String(existing.price) : String(Math.round(currentPrice)));
    setOverrideClosed(existing?.closed || false);
    setShowOverride(true);
  };

  const handleSaveOverride = async () => {
    if (!propertyId || !overridePrice) return;
    const { error } = await supabase.from('rate_overrides').upsert({
      property_id: propertyId,
      room_type: selectedRoomType,
      date: overrideDate,
      price: parseFloat(overridePrice),
      closed: overrideClosed,
    }, { onConflict: 'property_id,room_type,date' });

    if (error) { toast.error(error.message); return; }
    toast.success('Override saved');
    setShowOverride(false);

    // Refresh overrides
    const monthStart = toDateString(startOfMonth(currentMonth));
    const monthEnd = toDateString(endOfMonth(currentMonth));
    const ov = await fetchOverrides(propertyId, selectedRoomType, monthStart, monthEnd);
    setOverrides(ov);
  };

  const handleRemoveOverride = async () => {
    if (!propertyId) return;
    await supabase.from('rate_overrides').delete()
      .eq('property_id', propertyId)
      .eq('room_type', selectedRoomType)
      .eq('date', overrideDate);
    toast.success('Override removed');
    setShowOverride(false);

    const monthStart = toDateString(startOfMonth(currentMonth));
    const monthEnd = toDateString(endOfMonth(currentMonth));
    const ov = await fetchOverrides(propertyId, selectedRoomType, monthStart, monthEnd);
    setOverrides(ov);
  };

  const getCellColor = (night: NightBreakdown) => {
    if (night.closed) return 'bg-destructive/20 border-destructive/40 text-destructive';
    if (night.override) return 'bg-blue-500/15 border-blue-500/40';
    if (night.seasonal) return 'bg-orange-500/15 border-orange-500/40';
    if (night.dayOfWeek) return 'bg-purple-500/15 border-purple-500/40';
    return 'bg-card border-border';
  };

  return (
    <DashboardLayout title="Rate Calendar">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Rate Calendar</h1>
            <p className="text-muted-foreground">View and manage daily pricing per room type</p>
          </div>
        </div>

        {/* Controls */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Room Type</Label>
                <Select value={selectedRoomType} onValueChange={setSelectedRoomType}>
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {roomTypes.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="font-semibold min-w-[140px] text-center">{format(currentMonth, 'MMMM yyyy')}</span>
                <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-card border border-border" /> Default</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-blue-500/30" /> Override</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-orange-500/30" /> Seasonal</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-purple-500/30" /> Weekend</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-destructive/30" /> Closed</div>
        </div>

        {/* Calendar Grid */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2">{d}</div>
            ))}

            {/* Empty cells for start of month */}
            {Array.from({ length: getDay(startOfMonth(currentMonth)) }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}

            {nightRates.map((night, i) => (
              <button
                key={night.date}
                onClick={() => isAdmin && openOverrideDialog(night.date, night.finalPrice)}
                disabled={!isAdmin}
                className={cn(
                  'rounded-xl border p-2 text-left transition-all min-h-[80px] relative group',
                  getCellColor(night),
                  isAdmin && 'hover:ring-2 hover:ring-ring cursor-pointer',
                  !isAdmin && 'cursor-default'
                )}
              >
                <div className="text-xs text-muted-foreground">{format(parseLocalDate(night.date), 'd')}</div>
                <div className="font-semibold text-sm mt-1">
                  {night.closed ? (
                    <Lock className="h-4 w-4" />
                  ) : (
                    <CurrencyDisplay amount={night.finalPrice} size="sm" />
                  )}
                </div>
                {night.seasonal && (
                  <div className="text-[10px] text-muted-foreground truncate mt-0.5">{night.seasonal}</div>
                )}
                {isAdmin && (
                  <Edit3 className="h-3 w-3 absolute top-2 right-2 opacity-0 group-hover:opacity-50 transition-opacity" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Override Dialog */}
      <Dialog open={showOverride} onOpenChange={setShowOverride}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Price Override — {overrideDate}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Price (LKR)</Label>
              <Input type="number" value={overridePrice} onChange={(e) => setOverridePrice(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={overrideClosed} onCheckedChange={setOverrideClosed} />
              <Label>Close date (block sales)</Label>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {overrides.has(overrideDate) && (
              <Button variant="outline" className="text-destructive" onClick={handleRemoveOverride}>Remove Override</Button>
            )}
            <Button variant="outline" onClick={() => setShowOverride(false)}>Cancel</Button>
            <Button onClick={handleSaveOverride}>Save Override</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

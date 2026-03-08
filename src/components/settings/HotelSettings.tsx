import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Hotel, Clock, Save, DollarSign, MapPin, Receipt, Globe, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useProperty } from '@/hooks/useProperty';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export function HotelSettings() {
  const { selectedProperty } = useProperty();
  const { isAdmin } = useAuth();
  const [checkoutTime, setCheckoutTime] = useState('11:00');
  const [checkinTime, setCheckinTime] = useState('14:00');
  const [fxRate, setFxRate] = useState('310');
  const [fxUpdatedAt, setFxUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingFx, setSavingFx] = useState(false);

  useEffect(() => {
    if (selectedProperty?.id) {
      fetchSettings();
    }
  }, [selectedProperty?.id]);

  const fetchSettings = async () => {
    if (!selectedProperty?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('property_inventory_settings')
        .select('checkout_time, checkin_time, fx_usd_lkr_rate, fx_updated_at')
        .eq('property_id', selectedProperty.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setCheckoutTime(data.checkout_time?.substring(0, 5) || '11:00');
        setCheckinTime(data.checkin_time?.substring(0, 5) || '14:00');
        if ((data as any).fx_usd_lkr_rate) {
          setFxRate(String((data as any).fx_usd_lkr_rate));
        }
        if ((data as any).fx_updated_at) {
          setFxUpdatedAt((data as any).fx_updated_at);
        }
      }
    } catch (error) {
      console.error('Error fetching hotel settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedProperty?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('property_inventory_settings')
        .upsert({
          property_id: selectedProperty.id,
          checkout_time: checkoutTime + ':00',
          checkin_time: checkinTime + ':00',
        }, { onConflict: 'property_id' });

      if (error) throw error;
      toast.success('Hotel times updated');
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFx = async () => {
    if (!selectedProperty?.id) return;
    const rate = parseFloat(fxRate);
    if (isNaN(rate) || rate <= 0) {
      toast.error('Please enter a valid exchange rate');
      return;
    }
    setSavingFx(true);
    try {
      const { error } = await supabase
        .from('property_inventory_settings')
        .upsert({
          property_id: selectedProperty.id,
          fx_usd_lkr_rate: rate,
          fx_updated_at: new Date().toISOString(),
        } as any, { onConflict: 'property_id' });

      if (error) throw error;
      setFxUpdatedAt(new Date().toISOString());
      toast.success('Exchange rate updated');
    } catch (error: any) {
      console.error('Error saving FX rate:', error);
      toast.error('Failed to save exchange rate');
    } finally {
      setSavingFx(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Property Info Grid */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="p-2 rounded-lg bg-primary/10">
              <Hotel className="h-4 w-4 text-primary" />
            </div>
            Hotel Information
          </CardTitle>
          <CardDescription>
            Property details and configuration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Property Name</Label>
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 border">
                <Hotel className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{selectedProperty?.name || "King's Bay Villa"}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Location</Label>
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 border">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{selectedProperty?.location || 'Colombo, Sri Lanka'}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Tax Rate</Label>
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 border">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">10%</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Currency</Label>
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 border">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">LKR (Rs.)</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Check-in / Check-out Times */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="p-2 rounded-lg bg-info/10">
              <Clock className="h-4 w-4 text-info" />
            </div>
            Check-in / Check-out Times
          </CardTitle>
          <CardDescription>
            Set default check-in and check-out times for this property
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="checkout" className="text-sm font-medium">Check-out Time</Label>
                  <Input
                    id="checkout"
                    type="time"
                    value={checkoutTime}
                    onChange={(e) => setCheckoutTime(e.target.value)}
                    disabled={!isAdmin}
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Guests are expected to vacate by this time
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="checkin" className="text-sm font-medium">Check-in Time</Label>
                  <Input
                    id="checkin"
                    type="time"
                    value={checkinTime}
                    onChange={(e) => setCheckinTime(e.target.value)}
                    disabled={!isAdmin}
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Earliest time guests can check in
                  </p>
                </div>
              </div>
              {isAdmin && (
                <>
                  <Separator />
                  <Button onClick={handleSave} disabled={saving} size="sm">
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? 'Saving...' : 'Save Times'}
                  </Button>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Exchange Rate */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="p-2 rounded-lg bg-warning/10">
              <DollarSign className="h-4 w-4 text-warning-foreground" />
            </div>
            Exchange Rate (USD → LKR)
          </CardTitle>
          <CardDescription>
            Set the current USD to LKR exchange rate for dual currency display
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-5">
            <div className="max-w-sm space-y-2">
              <Label htmlFor="fxRate" className="text-sm font-medium">1 USD = LKR</Label>
              <Input
                id="fxRate"
                type="number"
                step="0.01"
                value={fxRate}
                onChange={(e) => setFxRate(e.target.value)}
                disabled={!isAdmin}
                placeholder="310.00"
                className="font-mono"
              />
              {fxUpdatedAt && (
                <p className="text-xs text-muted-foreground">
                  Last updated: {new Date(fxUpdatedAt).toLocaleString()}
                </p>
              )}
            </div>
            {isAdmin && (
              <>
                <Separator />
                <Button onClick={handleSaveFx} disabled={savingFx} size="sm">
                  <Save className="h-4 w-4 mr-2" />
                  {savingFx ? 'Saving...' : 'Update Rate'}
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

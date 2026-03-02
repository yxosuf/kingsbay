import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Hotel, Clock, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useProperty } from '@/hooks/useProperty';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export function HotelSettings() {
  const { selectedProperty } = useProperty();
  const { isAdmin } = useAuth();
  const [checkoutTime, setCheckoutTime] = useState('11:00');
  const [checkinTime, setCheckinTime] = useState('14:00');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

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
        .select('checkout_time, checkin_time')
        .eq('property_id', selectedProperty.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        // Time comes as HH:MM:SS, we only need HH:MM
        setCheckoutTime(data.checkout_time?.substring(0, 5) || '11:00');
        setCheckinTime(data.checkin_time?.substring(0, 5) || '14:00');
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hotel className="h-5 w-5" />
            Hotel Information
          </CardTitle>
          <CardDescription>
            Configure your hotel details and settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Hotel Name</Label>
              <Input value={selectedProperty?.name || "King's Bay Villa"} disabled />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input value={selectedProperty?.location || 'Colombo, Sri Lanka'} disabled />
            </div>
            <div className="space-y-2">
              <Label>Tax Rate (%)</Label>
              <Input value="10" disabled />
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Input value="LKR (Rs.)" disabled />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Check-in / Check-out Times
          </CardTitle>
          <CardDescription>
            Set default check-in and check-out times for this property
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Check-out Time</Label>
                  <Input
                    type="time"
                    value={checkoutTime}
                    onChange={(e) => setCheckoutTime(e.target.value)}
                    disabled={!isAdmin}
                  />
                  <p className="text-xs text-muted-foreground">
                    Guests are expected to vacate by this time
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Check-in Time</Label>
                  <Input
                    type="time"
                    value={checkinTime}
                    onChange={(e) => setCheckinTime(e.target.value)}
                    disabled={!isAdmin}
                  />
                  <p className="text-xs text-muted-foreground">
                    Earliest time guests can check in
                  </p>
                </div>
              </div>
              {isAdmin && (
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Times'}
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Shield, Clock, AlertTriangle, Save } from 'lucide-react';

interface InventorySettingsData {
  id: string;
  property_id: string;
  safety_buffer: number;
  auto_close_at: number;
  sync_frequency: string;
}

interface InventorySettingsProps {
  settings: InventorySettingsData | null;
  onSave: (settings: Partial<InventorySettingsData>) => void;
}

export function InventorySettings({ settings, onSave }: InventorySettingsProps) {
  const [safetyBuffer, setSafetyBuffer] = useState(settings?.safety_buffer ?? 1);
  const [autoCloseAt, setAutoCloseAt] = useState(settings?.auto_close_at ?? 0);
  const [syncFrequency, setSyncFrequency] = useState(settings?.sync_frequency ?? 'hourly');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (settings) {
      setSafetyBuffer(settings.safety_buffer);
      setAutoCloseAt(settings.auto_close_at);
      setSyncFrequency(settings.sync_frequency);
    }
  }, [settings]);

  useEffect(() => {
    const changed = 
      safetyBuffer !== (settings?.safety_buffer ?? 1) ||
      autoCloseAt !== (settings?.auto_close_at ?? 0) ||
      syncFrequency !== (settings?.sync_frequency ?? 'hourly');
    setHasChanges(changed);
  }, [safetyBuffer, autoCloseAt, syncFrequency, settings]);

  const handleSave = () => {
    onSave({
      safety_buffer: safetyBuffer,
      auto_close_at: autoCloseAt,
      sync_frequency: syncFrequency,
    });
    setHasChanges(false);
  };

  return (
    <div className="space-y-6">
      {/* Safety Buffer */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Safety Buffer
          </CardTitle>
          <CardDescription>
            Hold back rooms from OTA channels to prevent overbooking during high-demand periods.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="buffer">Rooms to hold back</Label>
            <Input
              id="buffer"
              type="number"
              min="0"
              max="10"
              value={safetyBuffer}
              onChange={(e) => setSafetyBuffer(parseInt(e.target.value) || 0)}
              className="max-w-[200px]"
            />
            <p className="text-sm text-muted-foreground">
              These rooms will not be shown as available on external channels.
              Set to 0 to show all available rooms.
            </p>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <h4 className="font-medium text-sm mb-2">How it works:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• If you have 6 rooms and set buffer to 1, OTAs will see 5 available</li>
              <li>• This prevents overbooking from sync delays</li>
              <li>• Direct bookings can still use all rooms</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Auto-Close Threshold */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Auto-Close Threshold
          </CardTitle>
          <CardDescription>
            Automatically close availability on OTAs when inventory drops below a threshold.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="auto-close">Close OTAs when rooms left reaches</Label>
            <Input
              id="auto-close"
              type="number"
              min="0"
              max="10"
              value={autoCloseAt}
              onChange={(e) => setAutoCloseAt(parseInt(e.target.value) || 0)}
              className="max-w-[200px]"
            />
            <p className="text-sm text-muted-foreground">
              Set to 0 to disable auto-close. When enabled, OTAs will show "no availability"
              when remaining rooms hit this number.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Sync Frequency */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-500" />
            Sync Frequency
          </CardTitle>
          <CardDescription>
            How often to sync calendars with external channels.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="frequency">Sync interval</Label>
            <Select value={syncFrequency} onValueChange={setSyncFrequency}>
              <SelectTrigger className="max-w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="realtime">Real-time (when available)</SelectItem>
                <SelectItem value="5min">Every 5 minutes</SelectItem>
                <SelectItem value="15min">Every 15 minutes</SelectItem>
                <SelectItem value="hourly">Every hour</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              More frequent syncs reduce the risk of double bookings but may increase API usage.
            </p>
          </div>

          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <h4 className="font-medium text-sm text-amber-600 dark:text-amber-400 mb-1">
              Note about iCal sync
            </h4>
            <p className="text-sm text-muted-foreground">
              iCal-based sync has inherent delays (15-30 min). For real-time sync,
              you'll need API integration with the OTA platforms (requires business verification).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={!hasChanges}>
          <Save className="h-4 w-4 mr-2" />
          Save Settings
        </Button>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Bell, BellRing, CalendarDays, LogIn, AlertTriangle, Wrench, Wifi, Megaphone, Save } from 'lucide-react';
import { useNotificationPreferences, NotificationPreferences } from '@/hooks/useNotificationPreferences';
import { useBrowserNotifications } from '@/hooks/useBrowserNotifications';
import { toast } from 'sonner';

const CATEGORIES = [
  { key: 'booking', label: 'Bookings', desc: 'New, modified, cancelled bookings', icon: CalendarDays },
  { key: 'checkin_checkout', label: 'Check-in / Check-out', desc: 'Scheduled arrivals & departures', icon: LogIn },
  { key: 'availability', label: 'Availability Alerts', desc: 'Low inventory, blocked rooms', icon: AlertTriangle },
  { key: 'maintenance', label: 'Housekeeping / Maintenance', desc: 'Cleaning tasks and overdue alerts', icon: Wrench },
  { key: 'channel_sync', label: 'Channel Sync / OTA', desc: 'Sync failures and conflicts', icon: Wifi },
  { key: 'general', label: 'General', desc: 'Announcements and other alerts', icon: Megaphone },
];

export function NotificationSettings() {
  const { preferences, loading, saving, savePreferences } = useNotificationPreferences();
  const { permission, requestPermission } = useBrowserNotifications();
  const [local, setLocal] = useState<NotificationPreferences>(preferences);

  useEffect(() => {
    setLocal(preferences);
  }, [preferences]);

  const handleCategoryToggle = (key: string, checked: boolean) => {
    setLocal(prev => ({
      ...prev,
      categories: { ...prev.categories, [key]: checked },
    }));
  };

  const handleSave = async () => {
    const ok = await savePreferences(local);
    if (ok) toast.success('Notification preferences saved');
    else toast.error('Failed to save preferences');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Delivery Channels */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="p-2 rounded-lg bg-primary/10">
              <BellRing className="h-4 w-4 text-primary" />
            </div>
            Delivery Channels
          </CardTitle>
          <CardDescription>Choose how you receive notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">In-App Notifications</Label>
              <p className="text-xs text-muted-foreground">Bell icon dropdown and notification page</p>
            </div>
            <Switch
              checked={local.delivery_channels.in_app}
              onCheckedChange={(c) => setLocal(prev => ({
                ...prev,
                delivery_channels: { ...prev.delivery_channels, in_app: c },
              }))}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Push Notifications</Label>
              <p className="text-xs text-muted-foreground">
                {permission === 'granted'
                  ? 'Browser push notifications are enabled'
                  : permission === 'denied'
                    ? 'Push notifications are blocked by your browser'
                    : 'Enable browser push for high-priority alerts'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {permission === 'default' && (
                <Button variant="outline" size="sm" onClick={requestPermission} className="text-xs">
                  Enable
                </Button>
              )}
              <Switch
                checked={local.delivery_channels.push}
                onCheckedChange={(c) => setLocal(prev => ({
                  ...prev,
                  delivery_channels: { ...prev.delivery_channels, push: c },
                }))}
                disabled={permission === 'denied'}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Priority Threshold */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="p-2 rounded-lg bg-warning/10">
              <Bell className="h-4 w-4 text-warning-foreground" />
            </div>
            Priority Filter
          </CardTitle>
          <CardDescription>Set the minimum priority level for notifications you want to receive</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs space-y-2">
            <Label className="text-sm font-medium">Minimum Priority</Label>
            <Select
              value={local.priority_threshold}
              onValueChange={(v) => setLocal(prev => ({ ...prev, priority_threshold: v as any }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">All notifications (Low & above)</SelectItem>
                <SelectItem value="medium">Medium & High only</SelectItem>
                <SelectItem value="high">High priority only</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Notifications below this threshold will be grouped into a daily digest
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Category Toggles */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="p-2 rounded-lg bg-info/10">
              <CalendarDays className="h-4 w-4 text-info" />
            </div>
            Notification Categories
          </CardTitle>
          <CardDescription>Enable or disable specific notification types</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {CATEGORIES.map((cat, idx) => {
            const Icon = cat.icon;
            return (
              <div key={cat.key}>
                {idx > 0 && <Separator className="my-3" />}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-md bg-muted">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">{cat.label}</Label>
                      <p className="text-xs text-muted-foreground">{cat.desc}</p>
                    </div>
                  </div>
                  <Switch
                    checked={local.categories[cat.key] !== false}
                    onCheckedChange={(c) => handleCategoryToggle(cat.key, c)}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Preferences'}
        </Button>
      </div>
    </div>
  );
}

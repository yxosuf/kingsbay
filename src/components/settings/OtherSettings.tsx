import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Eye, Home, Palette } from 'lucide-react';
import { useUserSettings } from '@/hooks/useUserSettings';

const TOGGLEABLE_PAGES = [
  { url: '/front-desk', label: 'Front Desk' },
  { url: '/availability', label: 'Availability Calendar' },
  { url: '/channels', label: 'Channel Manager' },
  { url: '/rooms', label: 'Room Status' },
  { url: '/housekeeping', label: 'Housekeeping' },
  { url: '/rate-calendar', label: 'Rate Calendar' },
];

const LANDING_PAGE_OPTIONS = [
  { value: '/', label: 'Dashboard' },
  { value: '/front-desk', label: 'Front Desk' },
  { value: '/bookings', label: 'Bookings' },
  { value: '/availability', label: 'Availability Calendar' },
  { value: '/rooms', label: 'Room Status' },
];

export function OtherSettings() {
  const { settings, loading, saveSettings } = useUserSettings();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const togglePage = (url: string, checked: boolean) => {
    const hidden = checked
      ? settings.hidden_pages.filter(p => p !== url)
      : [...settings.hidden_pages, url];
    saveSettings({ hidden_pages: hidden });
  };

  return (
    <div className="space-y-6">
      {/* Page Visibility */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Sidebar Pages
          </CardTitle>
          <CardDescription>
            Choose which pages appear in the sidebar. Hidden pages are still accessible via direct URL.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {TOGGLEABLE_PAGES.map((page) => {
            const isVisible = !settings.hidden_pages.includes(page.url);
            return (
              <div key={page.url} className="flex items-center gap-3">
                <Checkbox
                  id={`page-${page.url}`}
                  checked={isVisible}
                  onCheckedChange={(checked) => togglePage(page.url, !!checked)}
                />
                <Label htmlFor={`page-${page.url}`} className="cursor-pointer">
                  {page.label}
                </Label>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Default Landing Page */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className="h-5 w-5" />
            Default Landing Page
          </CardTitle>
          <CardDescription>
            Choose which page loads when you open the app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={settings.default_landing_page}
            onValueChange={(value) => saveSettings({ default_landing_page: value })}
          >
            <SelectTrigger className="w-full max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANDING_PAGE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Theme */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Theme
          </CardTitle>
          <CardDescription>
            Switch between light and dark mode.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={settings.theme}
            onValueChange={(value) => saveSettings({ theme: value })}
            className="flex flex-col gap-3"
          >
            {[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
              { value: 'system', label: 'System' },
            ].map((opt) => (
              <div key={opt.value} className="flex items-center gap-3">
                <RadioGroupItem value={opt.value} id={`theme-${opt.value}`} />
                <Label htmlFor={`theme-${opt.value}`} className="cursor-pointer">
                  {opt.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>
    </div>
  );
}

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Settings, Trash2, Copy, ExternalLink } from 'lucide-react';
import { ChannelIcon } from './ChannelIcon';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface ChannelConnection {
  id: string;
  property_id: string;
  channel_type: string;
  is_enabled: boolean;
  api_key: string | null;
  ical_import_url: string | null;
  ical_export_url: string | null;
  ical_export_token: string | null;
  last_sync_at: string | null;
  sync_status: string;
  commission_rate: number | null;
  last_error_message?: string | null;
  created_at: string;
  updated_at: string;
}

interface ChannelInfo {
  name: string;
  description: string;
}

interface ChannelCardProps {
  channel: ChannelConnection;
  channelInfo: ChannelInfo;
  onUpdate: (id: string, updates: Partial<ChannelConnection>) => void;
  onDelete: (id: string) => void;
}

export function ChannelCard({ channel, channelInfo, onUpdate, onDelete }: ChannelCardProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [icalImportUrl, setIcalImportUrl] = useState(channel.ical_import_url || '');
  const [commissionRate, setCommissionRate] = useState(channel.commission_rate?.toString() || '');

  const handleToggle = (enabled: boolean) => {
    onUpdate(channel.id, { is_enabled: enabled });
  };

  const handleSaveSettings = () => {
    onUpdate(channel.id, {
      ical_import_url: icalImportUrl || null,
      commission_rate: commissionRate ? parseFloat(commissionRate) : null,
    });
    setSettingsOpen(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-primary/10 text-primary border-primary/20';
      case 'error':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Card className={channel.is_enabled ? 'border-primary/50' : ''}>
      <CardHeader className="p-3 sm:p-6 pb-1 sm:pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <ChannelIcon type={channel.channel_type} size="sm" />
            <div>
              <CardTitle className="text-sm sm:text-base">{channelInfo.name}</CardTitle>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                {channel.commission_rate ? `${channel.commission_rate}% commission` : 'No commission set'}
              </p>
            </div>
          </div>
          <Switch
            checked={channel.is_enabled}
            onCheckedChange={handleToggle}
          />
        </div>
      </CardHeader>
      <CardContent className="p-3 sm:p-6 pt-1 sm:pt-0 space-y-2 sm:space-y-3">
        {/* Status Badge */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn("text-[10px] sm:text-xs", getStatusColor(channel.sync_status))}>
              {channel.sync_status === 'active' ? 'Active' : 
               channel.sync_status === 'error' ? 'Error' : 'Disabled'}
            </Badge>
            {channel.last_sync_at && (
              <span className="text-[10px] sm:text-xs text-muted-foreground">
                Last sync: {format(new Date(channel.last_sync_at), 'MMM d, HH:mm')}
              </span>
            )}
          </div>
          {channel.sync_status === 'error' && channel.last_error_message && (
            <p className="text-[10px] sm:text-xs text-destructive truncate" title={channel.last_error_message}>
              {channel.last_error_message}
            </p>
          )}
        </div>

        {/* iCal URLs Preview */}
        {channel.is_enabled && channel.ical_export_url && (
          <div className="flex items-center gap-2 p-1.5 sm:p-2 bg-muted rounded text-[10px] sm:text-xs">
            <span className="text-muted-foreground shrink-0">Export:</span>
            <span className="truncate flex-1 font-mono">{channel.ical_export_url}</span>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-5 w-5 sm:h-6 sm:w-6 shrink-0"
              onClick={() => copyToClipboard(channel.ical_export_url!)}
            >
              <Copy className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
            </Button>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1 sm:pt-2">
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="flex-1 h-8 text-xs sm:text-sm">
                <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                Settings
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ChannelIcon type={channel.channel_type} size="sm" />
                  {channelInfo.name} Settings
                </DialogTitle>
                <DialogDescription>
                  Configure the connection settings for this channel.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="commission">Commission Rate (%)</Label>
                  <Input
                    id="commission"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={commissionRate}
                    onChange={(e) => setCommissionRate(e.target.value)}
                    placeholder="e.g., 15"
                  />
                  <p className="text-xs text-muted-foreground">
                    The commission percentage charged by this channel.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ical-import">iCal Import URL</Label>
                  <Input
                    id="ical-import"
                    value={icalImportUrl}
                    onChange={(e) => setIcalImportUrl(e.target.value)}
                    placeholder="https://..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Paste the iCal URL from {channelInfo.name} to import bookings.
                  </p>
                </div>

                {channel.ical_export_url && (
                  <div className="space-y-2">
                    <Label>iCal Export URL (for {channelInfo.name})</Label>
                    <div className="flex gap-2">
                      <Input
                        value={channel.ical_export_url}
                        readOnly
                        className="font-mono text-xs"
                      />
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => copyToClipboard(channel.ical_export_url!)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Add this URL to {channelInfo.name} to sync your availability.
                    </p>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSettingsOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveSettings}>
                  Save Changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive h-8">
                <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove {channelInfo.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove the channel connection and stop syncing. You can add it again later.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(channel.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}

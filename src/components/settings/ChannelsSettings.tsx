import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  RefreshCw, 
  Settings2, 
  Activity, 
  Link2,
  ExternalLink,
  AlertTriangle,
  Map,
  Mail,
  Plus,
  Plug,
  ClipboardList,
  Package,
  ScrollText,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useProperty } from '@/hooks/useProperty';
import { toast } from 'sonner';
import { ChannelCard } from '@/components/channels/ChannelCard';
import { ChannelIcon } from '@/components/channels/ChannelIcon';
import { InventorySettings } from '@/components/channels/InventorySettings';
import { SyncStatus } from '@/components/channels/SyncStatus';
import { ChannelRoomMappings } from '@/components/channels/ChannelRoomMappings';
import { NeedsReviewBookings } from '@/components/channels/NeedsReviewBookings';
import { EmailImportSettings } from '@/components/channels/EmailImportSettings';
import { format, differenceInMinutes } from 'date-fns';
import { cn } from '@/lib/utils';

interface ChannelConnection {
  id: string;
  property_id: string;
  channel_type: string;
  is_enabled: boolean;
  api_key: string | null;
  ical_import_url: string | null;
  ical_export_url: string | null;
  last_sync_at: string | null;
  sync_status: string;
  commission_rate: number | null;
  last_error_message: string | null;
  created_at: string;
  updated_at: string;
}

interface InventorySettingsData {
  id: string;
  property_id: string;
  safety_buffer: number;
  auto_close_at: number;
  sync_frequency: string;
}

interface SyncLog {
  id: string;
  channel_id: string;
  direction: string;
  status: string;
  records_synced: number;
  error_message: string | null;
  created_at: string;
}

const CHANNEL_OPTIONS = [
  { type: 'direct', name: 'Direct Bookings', description: 'Walk-ins and phone bookings' },
  { type: 'booking_com', name: 'Booking.com', description: 'World\'s largest OTA' },
  { type: 'airbnb', name: 'Airbnb', description: 'Vacation rentals platform' },
  { type: 'agoda', name: 'Agoda', description: 'Asia-Pacific focused OTA' },
  { type: 'expedia', name: 'Expedia', description: 'Travel booking platform' },
  { type: 'other_ota', name: 'Other OTA', description: 'Other booking channels' },
];

export function ChannelsSettings() {
  const { selectedProperty } = useProperty();
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<ChannelConnection[]>([]);
  const [inventorySettings, setInventorySettings] = useState<InventorySettingsData | null>(null);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [reviewCount, setReviewCount] = useState(0);

  useEffect(() => {
    if (selectedProperty?.id) {
      fetchData();
      fetchReviewCount();
    }
  }, [selectedProperty?.id]);

  const fetchReviewCount = async () => {
    if (!selectedProperty?.id) return;
    const { count } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('property_id', selectedProperty.id)
      .eq('needs_review', true);
    setReviewCount(count || 0);
  };

  const fetchData = async () => {
    if (!selectedProperty?.id) return;
    setLoading(true);

    try {
      const { data: channelData, error: channelError } = await supabase
        .from('channel_connections')
        .select('*')
        .eq('property_id', selectedProperty.id);

      if (channelError) throw channelError;
      setChannels((channelData as ChannelConnection[]) || []);

      const { data: settingsData, error: settingsError } = await supabase
        .from('property_inventory_settings')
        .select('*')
        .eq('property_id', selectedProperty.id)
        .maybeSingle();

      if (settingsError) throw settingsError;
      setInventorySettings(settingsData as InventorySettingsData | null);

      if (channelData && channelData.length > 0) {
        const channelIds = channelData.map(c => c.id);
        const { data: logsData, error: logsError } = await supabase
          .from('sync_logs')
          .select('*')
          .in('channel_id', channelIds)
          .order('created_at', { ascending: false })
          .limit(20);

        if (logsError) throw logsError;
        setSyncLogs((logsData as SyncLog[]) || []);
      }
    } catch (error) {
      console.error('Error fetching channel data:', error);
      toast.error('Failed to load channel data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateChannel = async (channelType: string) => {
    if (!selectedProperty?.id) return;

    try {
      const defaultCommission: Record<string, number> = {
        booking_com: 15,
        airbnb: 3,
        agoda: 18,
        expedia: 20,
        other_ota: 15,
        direct: 0,
      };

      const { error } = await supabase
        .from('channel_connections')
        .insert({
          property_id: selectedProperty.id,
          channel_type: channelType as any,
          commission_rate: defaultCommission[channelType] || 0,
        });

      if (error) throw error;
      toast.success('Channel added');
      fetchData();
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('This channel is already configured');
      } else {
        toast.error('Failed to add channel');
      }
    }
  };

  const handleUpdateChannel = async (channelId: string, updates: Partial<ChannelConnection>) => {
    try {
      const updateData: Record<string, any> = {};
      if (updates.is_enabled !== undefined) updateData.is_enabled = updates.is_enabled;
      if (updates.ical_import_url !== undefined) updateData.ical_import_url = updates.ical_import_url;
      if (updates.ical_export_url !== undefined) updateData.ical_export_url = updates.ical_export_url;
      if (updates.commission_rate !== undefined) updateData.commission_rate = updates.commission_rate;
      if (updates.api_key !== undefined) updateData.api_key = updates.api_key;

      const { error } = await supabase
        .from('channel_connections')
        .update(updateData)
        .eq('id', channelId);

      if (error) throw error;
      toast.success('Channel updated');
      fetchData();
    } catch (error) {
      toast.error('Failed to update channel');
    }
  };

  const handleDeleteChannel = async (channelId: string) => {
    try {
      const { error } = await supabase
        .from('channel_connections')
        .delete()
        .eq('id', channelId);

      if (error) throw error;
      toast.success('Channel removed');
      fetchData();
    } catch (error) {
      toast.error('Failed to remove channel');
    }
  };

  const handleSaveInventorySettings = async (settings: Partial<InventorySettingsData>) => {
    if (!selectedProperty?.id) return;

    try {
      if (inventorySettings?.id) {
        const { error } = await supabase
          .from('property_inventory_settings')
          .update({
            safety_buffer: settings.safety_buffer,
            auto_close_at: settings.auto_close_at,
            sync_frequency: settings.sync_frequency as any,
          })
          .eq('id', inventorySettings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('property_inventory_settings')
          .insert({
            property_id: selectedProperty.id,
            safety_buffer: settings.safety_buffer,
            auto_close_at: settings.auto_close_at,
            sync_frequency: settings.sync_frequency as any,
          });
        if (error) throw error;
      }
      toast.success('Settings saved');
      fetchData();
    } catch (error) {
      toast.error('Failed to save settings');
    }
  };

  const handleManualSync = async () => {
    if (!selectedProperty?.id) return;
    setSyncing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('channel-sync', {
        body: { propertyId: selectedProperty.id },
      });
      
      if (error) throw error;
      
      if (data.channelsSynced > 0) {
        toast.success(`Synced ${data.channelsSynced} channel(s) successfully`);
      } else if (data.channelsFailed > 0) {
        toast.error(`${data.channelsFailed} channel(s) failed to sync`);
      } else {
        toast.info('No channels configured for sync');
      }
      
      fetchData();
    } catch (error: any) {
      console.error('Sync error:', error);
      toast.error('Failed to sync channels');
    } finally {
      setSyncing(false);
    }
  };

  const enabledChannels = channels.filter(c => c.is_enabled);
  const availableChannels = CHANNEL_OPTIONS.filter(
    opt => !channels.some(c => c.channel_type === opt.type)
  );

  const getChannelInfo = (type: string) => {
    return CHANNEL_OPTIONS.find(c => c.type === type) || {
      name: type,
      description: 'Booking channel',
    };
  };

  // Determine last sync freshness
  const getLastSyncStatus = () => {
    if (!syncLogs[0]?.created_at) return { label: 'Never', color: 'text-destructive' };
    const mins = differenceInMinutes(new Date(), new Date(syncLogs[0].created_at));
    if (mins < 30) return { label: format(new Date(syncLogs[0].created_at), 'HH:mm'), color: 'text-success' };
    if (mins < 120) return { label: format(new Date(syncLogs[0].created_at), 'HH:mm'), color: 'text-warning' };
    return { label: format(new Date(syncLogs[0].created_at), 'HH:mm'), color: 'text-destructive' };
  };

  const lastSync = getLastSyncStatus();

  if (!selectedProperty) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Please select a property first</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Active Channels</p>
                <p className={cn(
                  "text-2xl font-bold mt-1",
                  enabledChannels.length > 0 ? "text-success" : "text-destructive"
                )}>
                  {enabledChannels.length}
                </p>
              </div>
              <div className={cn(
                "p-2 rounded-xl",
                enabledChannels.length > 0 ? "bg-success/10" : "bg-destructive/10"
              )}>
                <Link2 className={cn("h-5 w-5", enabledChannels.length > 0 ? "text-success" : "text-destructive")} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Safety Buffer</p>
                <p className="text-2xl font-bold mt-1">{inventorySettings?.safety_buffer ?? 1}</p>
              </div>
              <div className="p-2 rounded-xl bg-muted">
                <Settings2 className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Sync Frequency</p>
                <p className="text-2xl font-bold capitalize mt-1">
                  {inventorySettings?.sync_frequency?.replace('min', ' min') || 'Hourly'}
                </p>
              </div>
              <div className="p-2 rounded-xl bg-muted">
                <RefreshCw className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Last Sync</p>
                <p className={cn("text-2xl font-bold mt-1", lastSync.color)}>
                  {lastSync.label}
                </p>
              </div>
              <div className="p-2 rounded-xl bg-muted">
                <Activity className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sync Now aligned right */}
      <div className="flex justify-end">
        <Button 
          onClick={handleManualSync} 
          disabled={syncing || enabledChannels.length === 0}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", syncing && "animate-spin")} />
          {syncing ? 'Syncing...' : 'Sync Now'}
        </Button>
      </div>

      {/* Tabs with renamed labels */}
      <Tabs defaultValue="connections" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-transparent p-0">
          <TabsTrigger value="connections" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-xl">
            <Plug className="h-4 w-4" />
            Connections
          </TabsTrigger>
          <TabsTrigger value="email-intake" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-xl">
            <Mail className="h-4 w-4" />
            Email Intake
          </TabsTrigger>
          <TabsTrigger value="room-mapping" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-xl">
            <Map className="h-4 w-4" />
            Room Mapping
          </TabsTrigger>
          <TabsTrigger value="review-queue" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-xl">
            <ClipboardList className="h-4 w-4" />
            Review Queue
            {reviewCount > 0 && (
              <Badge variant="destructive" className="h-5 min-w-5 px-1.5 flex items-center justify-center text-xs">
                {reviewCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="inventory-rules" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-xl">
            <Package className="h-4 w-4" />
            Inventory Rules
          </TabsTrigger>
          <TabsTrigger value="sync-logs" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-xl">
            <ScrollText className="h-4 w-4" />
            Sync Logs
          </TabsTrigger>
        </TabsList>

        {/* Connections */}
        <TabsContent value="connections" className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Connected Channels</h3>
              {availableChannels.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  {availableChannels.length} channel{availableChannels.length !== 1 ? 's' : ''} available
                </div>
              )}
            </div>
            {loading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map(i => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="h-40" />
                  </Card>
                ))}
              </div>
            ) : channels.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Link2 className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-center">
                    No channels configured yet. Add a channel below to get started.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {channels.map(channel => (
                  <ChannelCard
                    key={channel.id}
                    channel={channel}
                    channelInfo={getChannelInfo(channel.channel_type)}
                    onUpdate={handleUpdateChannel}
                    onDelete={handleDeleteChannel}
                  />
                ))}
              </div>
            )}
          </div>

          {availableChannels.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Add Channel
              </h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {availableChannels.map(option => (
                  <Card 
                    key={option.type} 
                    className="cursor-pointer hover:border-primary transition-colors group"
                    onClick={() => handleCreateChannel(option.type)}
                  >
                    <CardContent className="flex items-center gap-4 p-4">
                      <ChannelIcon type={option.type} size="md" />
                      <div className="flex-1">
                        <h4 className="font-medium">{option.name}</h4>
                        <p className="text-sm text-muted-foreground">{option.description}</p>
                      </div>
                      <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="email-intake">
          <EmailImportSettings />
        </TabsContent>

        <TabsContent value="room-mapping">
          <ChannelRoomMappings />
        </TabsContent>

        <TabsContent value="review-queue">
          <NeedsReviewBookings />
        </TabsContent>

        <TabsContent value="inventory-rules">
          <InventorySettings
            settings={inventorySettings}
            onSave={handleSaveInventorySettings}
          />
        </TabsContent>

        <TabsContent value="sync-logs">
          <SyncStatus 
            logs={syncLogs}
            channels={channels}
            getChannelInfo={getChannelInfo}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

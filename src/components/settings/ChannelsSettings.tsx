import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
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
  Wifi,
  WifiOff,
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
  ical_export_token: string | null;
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

  const getLastSyncStatus = () => {
    if (!syncLogs[0]?.created_at) return { label: 'Never', color: 'text-destructive', bg: 'bg-destructive/10' };
    const mins = differenceInMinutes(new Date(), new Date(syncLogs[0].created_at));
    if (mins < 30) return { label: format(new Date(syncLogs[0].created_at), 'HH:mm'), color: 'text-success', bg: 'bg-success/10' };
    if (mins < 120) return { label: format(new Date(syncLogs[0].created_at), 'HH:mm'), color: 'text-warning', bg: 'bg-warning/10' };
    return { label: format(new Date(syncLogs[0].created_at), 'HH:mm'), color: 'text-destructive', bg: 'bg-destructive/10' };
  };

  const lastSync = getLastSyncStatus();

  if (!selectedProperty) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="p-3 rounded-2xl bg-muted/60 mb-4">
          <Plug className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground font-medium">Please select a property first</p>
        <p className="text-sm text-muted-foreground mt-1">Channel settings are property-specific</p>
      </div>
    );
  }

  const statCards = [
    {
      label: 'Active Channels',
      value: enabledChannels.length,
      icon: enabledChannels.length > 0 ? Wifi : WifiOff,
      color: enabledChannels.length > 0 ? 'text-success' : 'text-destructive',
      bg: enabledChannels.length > 0 ? 'bg-success/10' : 'bg-destructive/10',
      border: enabledChannels.length > 0 ? 'border-success/20' : 'border-destructive/20',
    },
    {
      label: 'Safety Buffer',
      value: inventorySettings?.safety_buffer ?? 1,
      icon: Settings2,
      color: 'text-info',
      bg: 'bg-info/10',
      border: 'border-info/20',
    },
    {
      label: 'Sync Frequency',
      value: inventorySettings?.sync_frequency?.replace('min', ' min') || 'Hourly',
      icon: RefreshCw,
      color: 'text-primary',
      bg: 'bg-primary/10',
      border: 'border-primary/20',
    },
    {
      label: 'Last Sync',
      value: lastSync.label,
      icon: Activity,
      color: lastSync.color,
      bg: lastSync.bg,
      border: 'border-border',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Plug className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Channel Manager</h3>
            <p className="text-sm text-muted-foreground">Manage OTA connections and sync settings</p>
          </div>
        </div>
        <Button 
          onClick={handleManualSync} 
          disabled={syncing || enabledChannels.length === 0}
          size="sm"
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", syncing && "animate-spin")} />
          {syncing ? 'Syncing...' : 'Sync Now'}
        </Button>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          const variant = stat.color.includes('success') ? 'success'
            : stat.color.includes('warning') ? 'warning'
            : stat.color.includes('destructive') ? 'destructive'
            : stat.color.includes('info') ? 'info'
            : 'primary';
          return (
            <KpiCard key={stat.label} colorVariant={variant as any}>
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{stat.label}</p>
                    <p className={cn("text-2xl font-bold", stat.color)}>
                      {typeof stat.value === 'string' ? (
                        <span className="capitalize">{stat.value}</span>
                      ) : stat.value}
                    </p>
                  </div>
                  <div className={cn("p-2.5 rounded-xl", stat.bg)}>
                    <Icon className={cn("h-5 w-5", stat.color)} />
                  </div>
                </div>
              </div>
            </KpiCard>
          );
        })}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="connections" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-transparent p-0">
          {[
            { value: 'connections', icon: Plug, label: 'Connections' },
            { value: 'email-intake', icon: Mail, label: 'Email Intake' },
            { value: 'room-mapping', icon: Map, label: 'Room Mapping' },
            { value: 'review-queue', icon: ClipboardList, label: 'Review Queue', badge: reviewCount },
            { value: 'inventory-rules', icon: Package, label: 'Inventory Rules' },
            { value: 'sync-logs', icon: ScrollText, label: 'Sync Logs' },
          ].map((tab) => {
            const TabIcon = tab.icon;
            return (
              <TabsTrigger 
                key={tab.value}
                value={tab.value} 
                className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-xl"
              >
                <TabIcon className="h-4 w-4" />
                {tab.label}
                {tab.badge && tab.badge > 0 && (
                  <Badge variant="destructive" className="h-5 min-w-5 px-1.5 flex items-center justify-center text-xs">
                    {tab.badge}
                  </Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Connections */}
        <TabsContent value="connections" className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold">Connected Channels</h3>
              {availableChannels.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {availableChannels.length} available
                </Badge>
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
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="p-3 rounded-2xl bg-muted/60 mb-4">
                    <Link2 className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="font-medium text-muted-foreground">No channels configured</p>
                  <p className="text-sm text-muted-foreground mt-1">Add a channel below to get started</p>
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
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="text-base font-semibold flex items-center gap-2">
                  <Plus className="h-4 w-4 text-primary" />
                  Add Channel
                </h3>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {availableChannels.map(option => (
                    <Card 
                      key={option.type} 
                      className="cursor-pointer border-dashed hover:border-primary hover:bg-primary/5 transition-all group"
                      onClick={() => handleCreateChannel(option.type)}
                    >
                      <CardContent className="flex items-center gap-4 p-4">
                        <ChannelIcon type={option.type} size="md" />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm">{option.name}</h4>
                          <p className="text-xs text-muted-foreground truncate">{option.description}</p>
                        </div>
                        <Plus className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </>
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

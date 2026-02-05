import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  RefreshCw, 
  Settings2, 
  Activity, 
  Calendar,
  Link2,
  LinkIcon,
  ExternalLink
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useProperty } from '@/hooks/useProperty';
import { toast } from 'sonner';
import { ChannelCard } from '@/components/channels/ChannelCard';
import { ChannelIcon } from '@/components/channels/ChannelIcon';
import { InventorySettings } from '@/components/channels/InventorySettings';
import { SyncStatus } from '@/components/channels/SyncStatus';
import { format } from 'date-fns';

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

export default function ChannelManager() {
  const { selectedProperty } = useProperty();
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<ChannelConnection[]>([]);
  const [inventorySettings, setInventorySettings] = useState<InventorySettingsData | null>(null);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (selectedProperty?.id) {
      fetchData();
    }
  }, [selectedProperty?.id]);

  const fetchData = async () => {
    if (!selectedProperty?.id) return;
    setLoading(true);

    try {
      // Fetch channel connections
      const { data: channelData, error: channelError } = await supabase
        .from('channel_connections')
        .select('*')
        .eq('property_id', selectedProperty.id);

      if (channelError) throw channelError;
      setChannels((channelData as ChannelConnection[]) || []);

      // Fetch inventory settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('property_inventory_settings')
        .select('*')
        .eq('property_id', selectedProperty.id)
        .maybeSingle();

      if (settingsError) throw settingsError;
      setInventorySettings(settingsData as InventorySettingsData | null);

      // Fetch sync logs (last 20)
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
      // Build the update object with proper types
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
    setSyncing(true);
    // This will be implemented with the edge function later
    await new Promise(resolve => setTimeout(resolve, 2000));
    toast.info('Manual sync will be available once iCal functions are deployed');
    setSyncing(false);
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

  if (!selectedProperty) {
    return (
      <DashboardLayout title="Channel Manager">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Please select a property first</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Channel Manager">
      <div className="space-y-6">
        {/* Header Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Channels</CardTitle>
              <Link2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{enabledChannels.length}</div>
              <p className="text-xs text-muted-foreground">
                {channels.length} total configured
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Safety Buffer</CardTitle>
              <Settings2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {inventorySettings?.safety_buffer ?? 1} rooms
              </div>
              <p className="text-xs text-muted-foreground">
                Held back from OTAs
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sync Frequency</CardTitle>
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold capitalize">
                {inventorySettings?.sync_frequency?.replace('min', ' min') || 'Hourly'}
              </div>
              <p className="text-xs text-muted-foreground">
                Calendar sync interval
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Last Sync</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {syncLogs[0]?.created_at 
                  ? format(new Date(syncLogs[0].created_at), 'HH:mm')
                  : 'Never'}
              </div>
              <p className="text-xs text-muted-foreground">
                {syncLogs[0]?.status === 'success' ? 'Successful' : 
                 syncLogs[0]?.status === 'failed' ? 'Failed' : 'No syncs yet'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Manual Sync Button */}
        <div className="flex justify-end">
          <Button 
            onClick={handleManualSync} 
            disabled={syncing || enabledChannels.length === 0}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Now'}
          </Button>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="channels" className="space-y-4">
          <TabsList>
            <TabsTrigger value="channels" className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4" />
              Channels
            </TabsTrigger>
            <TabsTrigger value="inventory" className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              Inventory Settings
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Sync Logs
            </TabsTrigger>
          </TabsList>

          {/* Channels Tab */}
          <TabsContent value="channels" className="space-y-4">
            {/* Connected Channels */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Connected Channels</h3>
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

            {/* Add New Channel */}
            {availableChannels.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Add Channel</h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {availableChannels.map(option => (
                    <Card 
                      key={option.type} 
                      className="cursor-pointer hover:border-primary transition-colors"
                      onClick={() => handleCreateChannel(option.type)}
                    >
                      <CardContent className="flex items-center gap-4 p-4">
                        <ChannelIcon type={option.type} size="md" />
                        <div className="flex-1">
                          <h4 className="font-medium">{option.name}</h4>
                          <p className="text-sm text-muted-foreground">{option.description}</p>
                        </div>
                        <Button variant="ghost" size="icon">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Inventory Settings Tab */}
          <TabsContent value="inventory">
            <InventorySettings
              settings={inventorySettings}
              onSave={handleSaveInventorySettings}
            />
          </TabsContent>

          {/* Sync Logs Tab */}
          <TabsContent value="logs">
            <SyncStatus 
              logs={syncLogs}
              channels={channels}
              getChannelInfo={getChannelInfo}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

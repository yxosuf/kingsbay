import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Globe, FlaskConical, History, Settings as SettingsIcon, Key, Wifi } from 'lucide-react';
import { ChannelIcon } from '@/components/channels/ChannelIcon';
import { useProperty } from '@/hooks/useProperty';
import { useOtaSync } from '@/hooks/useOtaSync';
import { OtaApiKeyDialog } from '@/components/settings/OtaApiKeyDialog';
import { OtaSyncHistoryTable } from '@/components/settings/OtaSyncHistoryTable';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface OtaIntegration {
  id: string;
  property_id: string;
  ota_name: string;
  display_name: string;
  api_key: string | null;
  is_enabled: boolean;
  status: 'coming_soon' | 'disabled' | 'active';
  last_rate_push_at: string | null;
  last_availability_push_at: string | null;
}

const DEFAULT_OTAS = [
  { ota_name: 'booking_com', display_name: 'Booking.com' },
  { ota_name: 'airbnb', display_name: 'Airbnb' },
  { ota_name: 'expedia', display_name: 'Expedia' },
  { ota_name: 'agoda', display_name: 'Agoda' },
];

export function OtaSyncTab() {
  const { selectedProperty } = useProperty();
  const queryClient = useQueryClient();
  const [simulateEnabled, setSimulateEnabled] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null);

  const {
    integrations,
    syncLogs,
    integrationsLoading,
    logsLoading,
    saveApiKey,
    deleteApiKey,
    toggleEnabled,
    testConnection,
  } = useOtaSync(selectedProperty?.id);

  // Auto-seed default integrations on first load
  const DEFAULT_OTAS = [
    { ota_name: 'booking_com', display_name: 'Booking.com' },
    { ota_name: 'airbnb', display_name: 'Airbnb' },
    { ota_name: 'expedia', display_name: 'Expedia' },
    { ota_name: 'agoda', display_name: 'Agoda' },
  ];

  // Check if we need to seed integrations
  if (!integrationsLoading && integrations.length === 0 && selectedProperty?.id) {
    const seedIntegrations = async () => {
      const seedData = DEFAULT_OTAS.map(ota => ({
        property_id: selectedProperty.id,
        ota_name: ota.ota_name,
        display_name: ota.display_name,
        is_enabled: false,
        status: 'coming_soon',
      }));

      const { error } = await supabase
        .from('ota_integrations')
        .insert(seedData);

      if (!error) {
        queryClient.invalidateQueries({ queryKey: ['ota-integrations', selectedProperty.id] });
      }
    };

    seedIntegrations();
  }

  const selectedIntegrationData = integrations.find(i => i.id === selectedIntegration) || null;


  const simulateBookingMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProperty?.id) throw new Error('No property selected');

      // Get available rooms
      const { data: rooms, error: roomError } = await supabase
        .from('rooms')
        .select('id, room_number')
        .eq('property_id', selectedProperty.id)
        .eq('status', 'available')
        .limit(1);

      if (roomError) throw roomError;
      if (!rooms || rooms.length === 0) throw new Error('No available rooms');

      // Get a test guest or create one
      const { data: guests, error: guestError } = await supabase
        .from('guests')
        .select('id')
        .eq('property_id', selectedProperty.id)
        .eq('email', 'test@ota-simulation.local')
        .limit(1);

      let guestId: string;

      if (!guests || guests.length === 0) {
        const { data: newGuest, error: createError } = await supabase
          .from('guests')
          .insert([{
            name: 'OTA Test Guest',
            email: 'test@ota-simulation.local',
            property_id: selectedProperty.id,
          }])
          .select()
          .single();

        if (createError) throw createError;
        guestId = newGuest.id;
      } else {
        guestId = guests[0].id;
      }

      // Random OTA source
      const otaSources = ['booking_com', 'airbnb', 'expedia', 'agoda'];
      const randomSource = otaSources[Math.floor(Math.random() * otaSources.length)];

      // Create booking 3 days from now for 2 nights
      const checkIn = new Date();
      checkIn.setDate(checkIn.getDate() + 3);
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + 2);

      const { error: bookingError } = await supabase
        .from('bookings')
        .insert([{
          property_id: selectedProperty.id,
          room_id: rooms[0].id,
          guest_id: guestId,
          check_in: checkIn.toISOString().split('T')[0],
          check_out: checkOut.toISOString().split('T')[0],
          num_adults: 2,
          num_children: 0,
          booking_source: randomSource as any,
          needs_review: true,
          status: 'pending',
          total_amount: 15000,
          ota_price: 15000,
          commission_rate: 15,
          commission_amount: 2250,
        }]);

      if (bookingError) throw bookingError;

      return { source: randomSource, room: rooms[0].room_number };
    },
    onSuccess: (data) => {
      toast.success(
        `Simulated ${data.source.replace('_', '.')} booking created for Room ${data.room}`
      );
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
    onError: (error: Error) => {
      toast.error('Simulation failed: ' + error.message);
    },
  });

  if (!selectedProperty) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Please select a property
      </div>
    );
  }

  if (integrationsLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <Tabs defaultValue="connected" className="space-y-4">
        <TabsList>
          <TabsTrigger value="connected">
            <Globe className="h-4 w-4 mr-2" />
            Connected OTAs
          </TabsTrigger>
          <TabsTrigger value="settings">
            <SettingsIcon className="h-4 w-4 mr-2" />
            API Keys
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-4 w-4 mr-2" />
            Sync History
          </TabsTrigger>
          <TabsTrigger value="simulate">
            <FlaskConical className="h-4 w-4 mr-2" />
            Simulate
          </TabsTrigger>
        </TabsList>

        <TabsContent value="connected" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {integrations?.map((ota) => {
              const hasApiKey = !!ota.api_key;
              const isActive = hasApiKey && ota.is_enabled && ota.status !== 'coming_soon';

              return (
                <Card key={ota.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ChannelIcon type={ota.ota_name} size="md" />
                        <div>
                          <CardTitle className="text-lg">{ota.display_name}</CardTitle>
                          <CardDescription className="mt-1">
                            <Badge
                              variant={
                                isActive
                                  ? 'success'
                                  : ota.status === 'disabled' || hasApiKey
                                  ? 'outline'
                                  : 'warning'
                              }
                            >
                              {isActive
                                ? 'Active'
                                : ota.status === 'coming_soon' && !hasApiKey
                                ? 'Not Configured'
                                : 'Disabled'}
                            </Badge>
                          </CardDescription>
                        </div>
                      </div>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div>
                              <Switch
                                checked={ota.is_enabled}
                                disabled={!hasApiKey}
                                onCheckedChange={(enabled) =>
                                  toggleEnabled.mutate({ integrationId: ota.id, enabled })
                                }
                              />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            {hasApiKey
                              ? 'Toggle integration'
                              : 'Configure API key first'}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">API Key Status</span>
                      <Badge variant={hasApiKey ? 'success' : 'outline'} className="text-xs">
                        {hasApiKey ? 'Configured' : 'Not Set'}
                      </Badge>
                    </div>

                    {ota.sandbox_mode !== null && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Environment</span>
                        <Badge variant="outline" className="text-xs">
                          {ota.sandbox_mode ? 'Sandbox' : 'Production'}
                        </Badge>
                      </div>
                    )}

                    {ota.last_rate_push_at && (
                      <p className="text-xs text-muted-foreground">
                        Last sync:{' '}
                        {new Date(ota.last_rate_push_at).toLocaleDateString()}
                      </p>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-2"
                      onClick={() => setSelectedIntegration(ota.id)}
                    >
                      <Key className="h-3 w-3 mr-2" />
                      {hasApiKey ? 'Manage API Key' : 'Add API Key'}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>API Configuration</CardTitle>
              <CardDescription>
                Manage API keys for each OTA integration. Keys are encrypted and stored securely.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {integrations?.map((ota) => (
                  <Button
                    key={ota.id}
                    variant="outline"
                    className="h-16 flex items-center justify-between px-4"
                    onClick={() => setSelectedIntegration(ota.id)}
                  >
                    <div className="flex items-center gap-3">
                      <ChannelIcon type={ota.ota_name} size="md" />
                      <div className="text-left">
                        <p className="font-medium">{ota.display_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {ota.api_key ? 'Key configured' : 'No key set'}
                        </p>
                      </div>
                    </div>
                    <Key className="h-4 w-4 text-muted-foreground" />
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      <TabsContent value="history">
        <Card>
          <CardHeader>
            <CardTitle>Sync History</CardTitle>
            <CardDescription>
              View rate and availability push logs to connected OTAs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No Sync History</p>
              <p className="text-sm">
                Sync logs will appear here once OTA integrations are active.
              </p>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="simulate">
        <Card>
          <CardHeader>
            <CardTitle>Simulate OTA Bookings</CardTitle>
            <CardDescription>
              Generate test bookings to validate rate engine and overbooking prevention
              (Admin only)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label className="text-base">Enable Simulation Mode</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Create fake OTA bookings for testing
                </p>
              </div>
              <Switch
                checked={simulateEnabled}
                onCheckedChange={setSimulateEnabled}
              />
            </div>

            {simulateEnabled && (
              <div className="space-y-4 pt-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm mb-3">
                    This will create a test booking with:
                  </p>
                  <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                    <li>Random OTA source (Booking.com, Airbnb, etc.)</li>
                    <li>Check-in: 3 days from now</li>
                    <li>Check-out: 5 days from now (2 nights)</li>
                    <li>Status: Pending Review</li>
                    <li>Test guest profile</li>
                  </ul>
                </div>

                <Button
                  onClick={() => simulateBookingMutation.mutate()}
                  disabled={simulateBookingMutation.isPending}
                  className="w-full"
                >
                  {simulateBookingMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Generate Test Booking
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

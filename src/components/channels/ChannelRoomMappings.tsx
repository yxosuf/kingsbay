import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertTriangle,
  Link2,
  Check,
  RefreshCw,
  HelpCircle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useProperty } from '@/hooks/useProperty';
import { toast } from 'sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface RoomMapping {
  id: string;
  channel_connection_id: string;
  external_room_type_id: string | null;
  external_room_name: string;
  internal_room_id: string | null;
  is_active: boolean;
  created_at: string;
}

interface Room {
  id: string;
  room_number: string;
  room_type: string;
}

interface ChannelConnection {
  id: string;
  channel_type: string;
}

export function ChannelRoomMappings() {
  const { selectedProperty } = useProperty();
  const [loading, setLoading] = useState(true);
  const [mappings, setMappings] = useState<RoomMapping[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [channels, setChannels] = useState<ChannelConnection[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (selectedProperty?.id) {
      fetchData();
    }
  }, [selectedProperty?.id]);

  const fetchData = async () => {
    if (!selectedProperty?.id) return;
    setLoading(true);

    try {
      // Fetch channels for this property
      const { data: channelData } = await supabase
        .from('channel_connections')
        .select('id, channel_type')
        .eq('property_id', selectedProperty.id)
        .eq('is_enabled', true);

      setChannels(channelData || []);

      if (channelData && channelData.length > 0) {
        const channelIds = channelData.map(c => c.id);
        
        // Fetch room mappings
        const { data: mappingData } = await supabase
          .from('channel_room_mappings')
          .select('*')
          .in('channel_connection_id', channelIds)
          .order('created_at', { ascending: false });

        setMappings((mappingData as RoomMapping[]) || []);
      }

      // Fetch rooms for this property
      const { data: roomData } = await supabase
        .from('rooms')
        .select('id, room_number, room_type')
        .eq('property_id', selectedProperty.id)
        .order('room_number');

      setRooms(roomData || []);
    } catch (error) {
      console.error('Error fetching room mappings:', error);
      toast.error('Failed to load room mappings');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMapping = async (mappingId: string, roomId: string | null) => {
    setSaving(mappingId);

    try {
      const { error } = await supabase
        .from('channel_room_mappings')
        .update({ internal_room_id: roomId === 'none' ? null : roomId })
        .eq('id', mappingId);

      if (error) throw error;

      toast.success('Room mapping updated');
      fetchData();
    } catch (error) {
      console.error('Error updating mapping:', error);
      toast.error('Failed to update mapping');
    } finally {
      setSaving(null);
    }
  };

  const getChannelName = (channelId: string) => {
    const channel = channels.find(c => c.id === channelId);
    if (!channel) return 'Unknown';
    
    const names: Record<string, string> = {
      booking_com: 'Booking.com',
      airbnb: 'Airbnb',
      agoda: 'Agoda',
      expedia: 'Expedia',
      other_ota: 'Other OTA',
      direct: 'Direct',
    };
    return names[channel.channel_type] || channel.channel_type;
  };

  const unmappedCount = mappings.filter(m => !m.internal_room_id).length;

  if (!selectedProperty) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Please select a property first</p>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Room Mappings
            </CardTitle>
            <CardDescription>
              Map external OTA room types to your internal rooms
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {unmappedCount > 0 && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {unmappedCount} Unmapped
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : mappings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Link2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No room mappings yet.</p>
            <p className="text-sm mt-1">
              Mappings will appear here after syncing channels with iCal feeds.
            </p>
          </div>
        ) : (
          <>
            {unmappedCount > 0 && (
              <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">
                    {unmappedCount} room type(s) need mapping
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Bookings for unmapped rooms are marked "Needs Review" and must be manually assigned.
                  </p>
                </div>
              </div>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Channel</TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1">
                      External Room Name
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">
                              The room type name as it appears in the OTA calendar feed.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </TableHead>
                  <TableHead>Mapped To</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.map((mapping) => (
                  <TableRow key={mapping.id}>
                    <TableCell className="font-medium">
                      {getChannelName(mapping.channel_connection_id)}
                    </TableCell>
                    <TableCell>
                      <code className="bg-muted px-2 py-0.5 rounded text-sm">
                        {mapping.external_room_name}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={mapping.internal_room_id || 'none'}
                        onValueChange={(value) => handleUpdateMapping(mapping.id, value)}
                        disabled={saving === mapping.id}
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Select room..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            <span className="text-muted-foreground">Not mapped</span>
                          </SelectItem>
                          {rooms.map((room) => (
                            <SelectItem key={room.id} value={room.id}>
                              {room.room_number} ({room.room_type})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {mapping.internal_room_id ? (
                        <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                          <Check className="h-3 w-3" />
                          Mapped
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                          <AlertTriangle className="h-3 w-3" />
                          Unmapped
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParsedEvent {
  uid: string;
  summary: string;
  dtstart: string;
  dtend: string;
  description?: string;
}

// Parse iCal date format to YYYY-MM-DD
function parseICalDate(dateStr: string): string {
  // Handle YYYYMMDD format
  if (dateStr.length === 8) {
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  }
  // Handle YYYYMMDDTHHMMSS format
  if (dateStr.includes('T')) {
    const datePart = dateStr.split('T')[0];
    return `${datePart.slice(0, 4)}-${datePart.slice(4, 6)}-${datePart.slice(6, 8)}`;
  }
  return dateStr;
}

// Parse iCal content into events
function parseICal(icalContent: string): ParsedEvent[] {
  const events: ParsedEvent[] = [];
  const lines = icalContent.replace(/\r\n /g, '').split(/\r?\n/);
  
  let currentEvent: Partial<ParsedEvent> | null = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      currentEvent = {};
    } else if (line === 'END:VEVENT' && currentEvent) {
      if (currentEvent.uid && currentEvent.dtstart && currentEvent.dtend) {
        events.push(currentEvent as ParsedEvent);
      }
      currentEvent = null;
    } else if (currentEvent) {
      const [key, ...valueParts] = line.split(':');
      const value = valueParts.join(':');
      
      if (key === 'UID') {
        currentEvent.uid = value;
      } else if (key.startsWith('DTSTART')) {
        currentEvent.dtstart = parseICalDate(value);
      } else if (key.startsWith('DTEND')) {
        currentEvent.dtend = parseICalDate(value);
      } else if (key === 'SUMMARY') {
        currentEvent.summary = value.replace(/\\,/g, ',').replace(/\\n/g, '\n');
      } else if (key === 'DESCRIPTION') {
        currentEvent.description = value.replace(/\\,/g, ',').replace(/\\n/g, '\n');
      }
    }
  }

  return events;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { channelId } = await req.json();

    if (!channelId) {
      return new Response(
        JSON.stringify({ error: 'channelId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[iCal Import] Starting import for channel: ${channelId}`);

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch channel connection
    const { data: channel, error: channelError } = await supabase
      .from('channel_connections')
      .select('*, property:properties(name)')
      .eq('id', channelId)
      .single();

    if (channelError || !channel) {
      console.error('[iCal Import] Channel not found:', channelError);
      return new Response(
        JSON.stringify({ error: 'Channel not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!channel.ical_import_url) {
      console.log('[iCal Import] No iCal URL configured');
      return new Response(
        JSON.stringify({ error: 'No iCal URL configured for this channel' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[iCal Import] Fetching iCal from: ${channel.ical_import_url}`);

    // Fetch iCal content
    const icalResponse = await fetch(channel.ical_import_url, {
      headers: {
        'User-Agent': 'Lovable-Channel-Manager/1.0',
      },
    });

    if (!icalResponse.ok) {
      console.error(`[iCal Import] Failed to fetch iCal: ${icalResponse.status}`);
      
      // Log the failed sync
      await supabase.from('sync_logs').insert({
        channel_id: channelId,
        direction: 'inbound',
        status: 'failed',
        error_message: `HTTP ${icalResponse.status}: ${icalResponse.statusText}`,
        records_synced: 0,
      });

      // Update channel sync status
      await supabase
        .from('channel_connections')
        .update({ sync_status: 'error' })
        .eq('id', channelId);

      return new Response(
        JSON.stringify({ error: `Failed to fetch iCal feed: ${icalResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const icalContent = await icalResponse.text();
    console.log(`[iCal Import] Received ${icalContent.length} bytes`);

    // Parse iCal content
    const events = parseICal(icalContent);
    console.log(`[iCal Import] Parsed ${events.length} events`);

    // Get rooms for this property
    const { data: rooms } = await supabase
      .from('rooms')
      .select('id')
      .eq('property_id', channel.property_id);

    if (!rooms || rooms.length === 0) {
      console.log('[iCal Import] No rooms found for property');
      return new Response(
        JSON.stringify({ error: 'No rooms found for this property' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For now, we'll create blocks in room_availability
    // In a more advanced implementation, this would create actual bookings
    let recordsSynced = 0;
    const today = new Date().toISOString().split('T')[0];

    for (const event of events) {
      // Skip past events
      if (event.dtend < today) continue;

      // Create availability blocks for each day of the event
      const startDate = new Date(event.dtstart);
      const endDate = new Date(event.dtend);
      
      for (let date = startDate; date < endDate; date.setDate(date.getDate() + 1)) {
        const dateStr = date.toISOString().split('T')[0];

        // For simplicity, block the first room
        // In production, you'd have room mapping logic
        const roomId = rooms[0].id;

        // Upsert the availability block
        const { error: upsertError } = await supabase
          .from('room_availability')
          .upsert({
            room_id: roomId,
            date: dateStr,
            is_available: false,
            blocked_reason: `${channel.channel_type}: ${event.summary}`,
            source_channel: channel.channel_type,
          }, {
            onConflict: 'room_id,date',
          });

        if (!upsertError) {
          recordsSynced++;
        }
      }
    }

    console.log(`[iCal Import] Created/updated ${recordsSynced} availability records`);

    // Log successful sync
    await supabase.from('sync_logs').insert({
      channel_id: channelId,
      direction: 'inbound',
      status: 'success',
      records_synced: recordsSynced,
    });

    // Update channel last sync time and status
    await supabase
      .from('channel_connections')
      .update({ 
        last_sync_at: new Date().toISOString(),
        sync_status: 'active',
      })
      .eq('id', channelId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        eventsFound: events.length,
        recordsSynced,
        message: `Imported ${recordsSynced} availability blocks from ${events.length} events`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[iCal Import] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

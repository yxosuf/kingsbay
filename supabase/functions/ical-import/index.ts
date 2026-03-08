import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Property timezone for normalization
const PROPERTY_TIMEZONE = 'Asia/Colombo';

interface ParsedEvent {
  uid: string;
  summary: string;
  dtstart: string;
  dtend: string;
  description?: string;
}

interface RoomMapping {
  id: string;
  external_room_name: string;
  internal_room_id: string | null;
}

// Parse iCal date format to YYYY-MM-DD with proper timezone handling
function parseICalDate(dateStr: string): string {
  // Handle YYYYMMDD format (date-only, treat as local date in property timezone)
  if (dateStr.length === 8) {
    const year = dateStr.slice(0, 4);
    const month = dateStr.slice(4, 6);
    const day = dateStr.slice(6, 8);
    return `${year}-${month}-${day}`;
  }
  
  // Handle YYYYMMDDTHHMMSS format (datetime)
  if (dateStr.includes('T')) {
    const datePart = dateStr.split('T')[0];
    const year = datePart.slice(0, 4);
    const month = datePart.slice(4, 6);
    const day = datePart.slice(6, 8);
    
    // Check if it's UTC (ends with Z)
    if (dateStr.endsWith('Z')) {
      // Convert UTC to local date - for Asia/Colombo (UTC+5:30)
      // Create date object and adjust
      const dateObj = new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day),
        parseInt(dateStr.slice(9, 11)),
        parseInt(dateStr.slice(11, 13)),
        parseInt(dateStr.slice(13, 15) || '0')
      );
      // Add 5.5 hours for Asia/Colombo
      dateObj.setMinutes(dateObj.getMinutes() + 330);
      return dateObj.toISOString().split('T')[0];
    }
    
    // Non-UTC datetime - treat as property local time
    return `${year}-${month}-${day}`;
  }
  
  return dateStr;
}

// Extract room type/name from event summary or description
function extractRoomInfo(event: ParsedEvent): string {
  // Common patterns in OTA calendars:
  // "Room 101 - Booking.com" -> "Room 101"
  // "Reserved - Villa A" -> "Villa A"
  // "Airbnb Booking" -> use as-is
  
  let roomName = event.summary || 'Unknown Room';
  
  // Try to extract from description if summary is generic
  if (event.description) {
    // Look for room patterns in description
    const roomMatch = event.description.match(/room[:\s]+([^\n,]+)/i);
    if (roomMatch) {
      roomName = roomMatch[1].trim();
    }
  }
  
  // Clean up common prefixes
  roomName = roomName
    .replace(/^(reserved|blocked|booked)[:\s-]*/i, '')
    .replace(/\s*-\s*(booking\.com|airbnb|agoda|expedia)$/i, '')
    .trim();
  
  return roomName || 'Default Room';
}

// Parse iCal content into events
function parseICal(icalContent: string): ParsedEvent[] {
  const events: ParsedEvent[] = [];
  // Handle line folding (lines starting with space/tab are continuations)
  const lines = icalContent.replace(/\r\n[\t ]/g, '').split(/\r?\n/);
  
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
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) continue;
      
      const keyPart = line.substring(0, colonIndex);
      const value = line.substring(colonIndex + 1);
      
      // Handle properties with parameters (e.g., DTSTART;VALUE=DATE:20240101)
      const key = keyPart.split(';')[0];
      
      if (key === 'UID') {
        currentEvent.uid = value;
      } else if (key === 'DTSTART') {
        currentEvent.dtstart = parseICalDate(value);
      } else if (key === 'DTEND') {
        currentEvent.dtend = parseICalDate(value);
      } else if (key === 'SUMMARY') {
        currentEvent.summary = value.replace(/\\,/g, ',').replace(/\\n/g, '\n').replace(/\\;/g, ';');
      } else if (key === 'DESCRIPTION') {
        currentEvent.description = value.replace(/\\,/g, ',').replace(/\\n/g, '\n').replace(/\\;/g, ';');
      }
    }
  }

  return events;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // --- AUTH: Accept either a valid staff JWT or service-role key ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const bearerToken = authHeader.replace('Bearer ', '');
    const isServiceRole = bearerToken === supabaseServiceKey;

    if (!isServiceRole) {
      // Validate as user JWT
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(bearerToken);
      if (claimsError || !claimsData?.claims) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify staff role
      const svcClient = createClient(supabaseUrl, supabaseServiceKey);
      const { data: roleData } = await svcClient
        .from('user_roles')
        .select('role')
        .eq('user_id', claimsData.claims.sub)
        .single();

      if (!roleData || !['admin', 'manager'].includes(roleData.role)) {
        return new Response(
          JSON.stringify({ error: 'Insufficient permissions' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    // --- END AUTH ---

    const { channelId } = await req.json();

    if (!channelId) {
      return new Response(
        JSON.stringify({ error: 'channelId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[iCal Import] Starting import for channel: ${channelId}`);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch channel connection with property info
    const { data: channel, error: channelError } = await supabase
      .from('channel_connections')
      .select('*, property:properties(id, name)')
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
      const errorMsg = `HTTP ${icalResponse.status}: ${icalResponse.statusText}`;
      console.error(`[iCal Import] Failed to fetch iCal: ${errorMsg}`);
      
      // Log the failed sync
      await supabase.from('sync_logs').insert({
        channel_id: channelId,
        direction: 'inbound',
        status: 'failed',
        error_message: errorMsg,
        records_synced: 0,
      });

      // Update channel sync status with error
      await supabase
        .from('channel_connections')
        .update({ 
          sync_status: 'error',
          last_error_message: errorMsg,
        })
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

    // Get room mappings for this channel
    const { data: roomMappings } = await supabase
      .from('channel_room_mappings')
      .select('id, external_room_name, internal_room_id')
      .eq('channel_connection_id', channelId)
      .eq('is_active', true);

    const mappingsMap = new Map<string, RoomMapping>();
    (roomMappings || []).forEach(m => {
      mappingsMap.set(m.external_room_name.toLowerCase(), m);
    });

    // Get all rooms for this property (fallback)
    const { data: rooms } = await supabase
      .from('rooms')
      .select('id, room_number')
      .eq('property_id', channel.property_id);

    if (!rooms || rooms.length === 0) {
      console.log('[iCal Import] No rooms found for property');
      return new Response(
        JSON.stringify({ error: 'No rooms found for this property' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get existing external booking to find default guest
    const { data: defaultGuest } = await supabase
      .from('guests')
      .select('id')
      .eq('name', 'OTA Guest')
      .maybeSingle();

    let otaGuestId = defaultGuest?.id;

    // Create default OTA guest if not exists
    if (!otaGuestId) {
      const { data: newGuest, error: guestError } = await supabase
        .from('guests')
        .insert({
          name: 'OTA Guest',
          phone: 'External Booking',
          notes: 'Auto-created for OTA/iCal bookings',
        })
        .select()
        .single();

      if (guestError) {
        console.error('[iCal Import] Error creating OTA guest:', guestError);
      } else {
        otaGuestId = newGuest.id;
      }
    }

    // Process events
    const today = new Date().toISOString().split('T')[0];
    let recordsSynced = 0;
    let bookingsCreated = 0;
    let bookingsUpdated = 0;
    let unmappedRooms: string[] = [];
    let needsReviewCount = 0;

    for (const event of events) {
      // Skip past events
      if (event.dtend < today) continue;

      // Extract room info from event
      const externalRoomName = extractRoomInfo(event);
      
      // Look up room mapping
      const mapping = mappingsMap.get(externalRoomName.toLowerCase());
      let internalRoomId: string | null = null;
      let needsReview = false;
      let reviewReason: string | null = null;

      if (mapping && mapping.internal_room_id) {
        internalRoomId = mapping.internal_room_id;
      } else {
        // No mapping found - check if we should auto-create mapping
        if (!mapping) {
          // Create unmapped entry for admin to resolve
          const { error: mappingError } = await supabase
            .from('channel_room_mappings')
            .upsert({
              channel_connection_id: channelId,
              external_room_name: externalRoomName,
              internal_room_id: null,
              is_active: true,
            }, {
              onConflict: 'channel_connection_id,external_room_name',
            });

          if (!mappingError) {
            unmappedRooms.push(externalRoomName);
          }
        }

        // Mark as needs review - DO NOT auto-assign random room
        needsReview = true;
        reviewReason = `Unmapped room type: ${externalRoomName}`;
        needsReviewCount++;
        
        // Use first room as placeholder but mark for review
        internalRoomId = rooms[0].id;
      }

      // Generate external booking ID from UID
      const externalBookingId = `${channel.channel_type}_${event.uid}`;
      const externalSource = channel.channel_type;

      // Check if booking already exists (idempotent upsert)
      const { data: existingBooking } = await supabase
        .from('bookings')
        .select('id')
        .eq('external_source', externalSource)
        .eq('external_booking_id', externalBookingId)
        .maybeSingle();

      const bookingData = {
        guest_id: otaGuestId,
        room_id: internalRoomId,
        check_in: event.dtstart,
        check_out: event.dtend,
        status: 'confirmed',
        booking_source: channel.channel_type,
        external_booking_id: externalBookingId,
        external_source: externalSource,
        external_room_type_id: externalRoomName,
        special_requests: event.summary,
        property_id: channel.property_id,
        needs_review: needsReview,
        review_reason: reviewReason,
        commission_rate: channel.commission_rate,
      };

      if (existingBooking) {
        // Update existing booking
        const { error: updateError } = await supabase
          .from('bookings')
          .update({
            check_in: event.dtstart,
            check_out: event.dtend,
            special_requests: event.summary,
            needs_review: needsReview,
            review_reason: reviewReason,
          })
          .eq('id', existingBooking.id);

        if (!updateError) {
          bookingsUpdated++;
          recordsSynced++;
        }
      } else {
        // Insert new booking
        const { error: insertError } = await supabase
          .from('bookings')
          .insert(bookingData);

        if (insertError) {
          // Check if it's a duplicate constraint violation
          if (insertError.code === '23505') {
            console.log(`[iCal Import] Duplicate booking ignored: ${externalBookingId}`);
          } else if (insertError.message?.includes('already booked')) {
            // Overlap detected by trigger - mark as needs review
            console.log(`[iCal Import] Overlap detected for ${externalBookingId}, marking for review`);
            
            // Try again with needs_review flag
            const { error: retryError } = await supabase
              .from('bookings')
              .insert({
                ...bookingData,
                needs_review: true,
                review_reason: `Overlap detected: ${insertError.message}`,
                status: 'pending', // Use pending status for conflicts
              });
            
            if (!retryError) {
              bookingsCreated++;
              needsReviewCount++;
              recordsSynced++;
            }
          } else {
            console.error(`[iCal Import] Error inserting booking:`, insertError);
          }
        } else {
          bookingsCreated++;
          recordsSynced++;
        }
      }

      // Also create availability blocks for visual calendar
      const startDate = new Date(event.dtstart);
      const endDate = new Date(event.dtend);
      
      for (let date = new Date(startDate); date < endDate; date.setDate(date.getDate() + 1)) {
        const dateStr = date.toISOString().split('T')[0];

        if (internalRoomId) {
          await supabase
            .from('room_availability')
            .upsert({
              room_id: internalRoomId,
              date: dateStr,
              is_available: false,
              blocked_reason: `${channel.channel_type}: ${event.summary}`,
              source_channel: channel.channel_type,
            }, {
              onConflict: 'room_id,date',
            });
        }
      }
    }

    console.log(`[iCal Import] Created ${bookingsCreated}, Updated ${bookingsUpdated}, Needs Review: ${needsReviewCount}`);

    // Log successful sync
    await supabase.from('sync_logs').insert({
      channel_id: channelId,
      direction: 'inbound',
      status: needsReviewCount > 0 ? 'partial' : 'success',
      records_synced: recordsSynced,
      error_message: unmappedRooms.length > 0 
        ? `Unmapped rooms: ${unmappedRooms.join(', ')}`
        : null,
    });

    // Update channel last sync time and status
    await supabase
      .from('channel_connections')
      .update({ 
        last_sync_at: new Date().toISOString(),
        sync_status: needsReviewCount > 0 ? 'error' : 'active',
        last_error_message: needsReviewCount > 0 
          ? `${needsReviewCount} booking(s) need review`
          : null,
      })
      .eq('id', channelId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        eventsFound: events.length,
        recordsSynced,
        bookingsCreated,
        bookingsUpdated,
        needsReviewCount,
        unmappedRooms,
        message: `Synced ${recordsSynced} records. ${needsReviewCount > 0 ? `${needsReviewCount} need review.` : ''}`
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

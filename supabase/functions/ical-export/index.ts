import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Booking {
  id: string;
  check_in: string;
  check_out: string;
  status: string;
  guest: { name: string } | null;
}

interface RoomAvailability {
  date: string;
  blocked_reason: string | null;
}

// Generate a unique UID for iCal events
function generateUID(id: string, domain: string): string {
  return `${id}@${domain}`;
}

// Format date to iCal format (YYYYMMDD)
function formatDate(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

// Escape special characters in iCal text
function escapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const propertyId = url.searchParams.get('property_id');
    const roomType = url.searchParams.get('room_type');
    const roomId = url.searchParams.get('room_id');

    if (!propertyId) {
      return new Response(
        JSON.stringify({ error: 'property_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[iCal Export] Generating feed for property: ${propertyId}, roomType: ${roomType}, roomId: ${roomId}`);

    // Create Supabase client with service role for full access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch property info
    const { data: property, error: propError } = await supabase
      .from('properties')
      .select('name')
      .eq('id', propertyId)
      .single();

    if (propError || !property) {
      console.error('[iCal Export] Property not found:', propError);
      return new Response(
        JSON.stringify({ error: 'Property not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build room query
    let roomQuery = supabase
      .from('rooms')
      .select('id, room_number, room_type')
      .eq('property_id', propertyId);

    if (roomId) {
      roomQuery = roomQuery.eq('id', roomId);
    } else if (roomType) {
      roomQuery = roomQuery.eq('room_type', roomType);
    }

    const { data: rooms, error: roomsError } = await roomQuery;

    if (roomsError) {
      console.error('[iCal Export] Error fetching rooms:', roomsError);
      throw roomsError;
    }

    if (!rooms || rooms.length === 0) {
      console.log('[iCal Export] No rooms found');
      return new Response(
        JSON.stringify({ error: 'No rooms found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const roomIds = rooms.map(r => r.id);
    console.log(`[iCal Export] Found ${roomIds.length} rooms`);

    // Fetch bookings for next 365 days
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 365);

    const startDate = today.toISOString().split('T')[0];
    const endDate = futureDate.toISOString().split('T')[0];

    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        id,
        check_in,
        check_out,
        status,
        guest:guests(name)
      `)
      .in('room_id', roomIds)
      .gte('check_out', startDate)
      .lte('check_in', endDate)
      .in('status', ['confirmed', 'checked_in', 'pending']);

    if (bookingsError) {
      console.error('[iCal Export] Error fetching bookings:', bookingsError);
      throw bookingsError;
    }

    // Fetch manual blocks from room_availability
    const { data: blocks, error: blocksError } = await supabase
      .from('room_availability')
      .select('date, blocked_reason')
      .in('room_id', roomIds)
      .eq('is_available', false)
      .gte('date', startDate)
      .lte('date', endDate);

    if (blocksError) {
      console.error('[iCal Export] Error fetching blocks:', blocksError);
      throw blocksError;
    }

    console.log(`[iCal Export] Found ${bookings?.length || 0} bookings and ${blocks?.length || 0} blocks`);

    // Generate iCal content
    const domain = 'lovable.app';
    const calendarName = roomType 
      ? `${property.name} - ${roomType}`
      : roomId 
        ? `${property.name} - Room ${rooms[0]?.room_number}`
        : `${property.name} - All Rooms`;

    let ical = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Lovable//Channel Manager//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${escapeText(calendarName)}`,
    ];

    // Add booking events
    (bookings || []).forEach((booking: any) => {
      const guest = Array.isArray(booking.guest) ? booking.guest[0] : booking.guest;
      const guestName = guest?.name || 'Guest';
      
      ical.push(
        'BEGIN:VEVENT',
        `UID:${generateUID(booking.id, domain)}`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
        `DTSTART;VALUE=DATE:${formatDate(booking.check_in)}`,
        `DTEND;VALUE=DATE:${formatDate(booking.check_out)}`,
        `SUMMARY:${escapeText(`Booked - ${guestName}`)}`,
        `DESCRIPTION:${escapeText(`Status: ${booking.status}\\nBooking ID: ${booking.id}`)}`,
        'STATUS:CONFIRMED',
        'TRANSP:OPAQUE',
        'END:VEVENT'
      );
    });

    // Add manual blocks as events
    (blocks || []).forEach((block: RoomAvailability, index: number) => {
      const nextDay = new Date(block.date);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = nextDay.toISOString().split('T')[0];

      ical.push(
        'BEGIN:VEVENT',
        `UID:${generateUID(`block-${block.date}-${index}`, domain)}`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
        `DTSTART;VALUE=DATE:${formatDate(block.date)}`,
        `DTEND;VALUE=DATE:${formatDate(nextDayStr)}`,
        `SUMMARY:${escapeText(block.blocked_reason || 'Not Available')}`,
        'STATUS:CONFIRMED',
        'TRANSP:OPAQUE',
        'END:VEVENT'
      );
    });

    ical.push('END:VCALENDAR');

    const icalContent = ical.join('\r\n');
    console.log(`[iCal Export] Generated iCal with ${(bookings?.length || 0) + (blocks?.length || 0)} events`);

    return new Response(icalContent, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${property.name.replace(/[^a-z0-9]/gi, '_')}_calendar.ics"`,
      },
    });
  } catch (error) {
    console.error('[iCal Export] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

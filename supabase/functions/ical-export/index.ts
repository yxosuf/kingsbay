import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

interface RoomAvailability {
  date: string;
  blocked_reason: string | null;
}

function generateUID(id: string, domain: string): string {
  return `${id}@${domain}`;
}

function formatDate(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

function escapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const propertyId = url.searchParams.get('property_id');
    const roomType = url.searchParams.get('room_type');
    const roomId = url.searchParams.get('room_id');
    const token = url.searchParams.get('token');

    // --- AUTH: Require valid export token ---
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Missing token parameter' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate token against channel_connections
    const { data: tokenChannel, error: tokenError } = await supabase
      .from('channel_connections')
      .select('property_id, is_enabled')
      .eq('ical_export_token', token)
      .eq('is_enabled', true)
      .single();

    if (tokenError || !tokenChannel) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use the property_id from the validated token, not from query params
    const validatedPropertyId = tokenChannel.property_id;

    // If property_id was provided in query, it must match the token's property
    if (propertyId && propertyId !== validatedPropertyId) {
      return new Response(
        JSON.stringify({ error: 'Token does not match requested property' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // --- END AUTH ---

    console.log(`[iCal Export] Generating feed for property: ${validatedPropertyId}, roomType: ${roomType}, roomId: ${roomId}`);

    const { data: property, error: propError } = await supabase
      .from('properties')
      .select('name')
      .eq('id', validatedPropertyId)
      .single();

    if (propError || !property) {
      return new Response(
        JSON.stringify({ error: 'Property not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let roomQuery = supabase
      .from('rooms')
      .select('id, room_number, room_type')
      .eq('property_id', validatedPropertyId);

    if (roomId) {
      roomQuery = roomQuery.eq('id', roomId);
    } else if (roomType) {
      roomQuery = roomQuery.eq('room_type', roomType);
    }

    const { data: rooms, error: roomsError } = await roomQuery;
    if (roomsError) throw roomsError;

    if (!rooms || rooms.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No rooms found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const roomIds = rooms.map(r => r.id);

    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 365);
    const startDate = today.toISOString().split('T')[0];
    const endDate = futureDate.toISOString().split('T')[0];

    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select(`id, check_in, check_out, status, guest:guests(name)`)
      .in('room_id', roomIds)
      .gte('check_out', startDate)
      .lte('check_in', endDate)
      .in('status', ['confirmed', 'checked_in', 'pending']);

    if (bookingsError) throw bookingsError;

    const { data: blocks, error: blocksError } = await supabase
      .from('room_availability')
      .select('date, blocked_reason')
      .in('room_id', roomIds)
      .eq('is_available', false)
      .gte('date', startDate)
      .lte('date', endDate);

    if (blocksError) throw blocksError;

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
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

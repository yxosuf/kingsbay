import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'
import { requireServiceRole } from '../_shared/auth.ts'

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'))

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Only callable via service-role key (cron job)
  const auth = requireServiceRole(req)
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.message }), {
      status: auth.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Find all needs_review bookings where hold has expired
    const { data: expiredHolds, error: fetchError } = await supabase
      .from('bookings')
      .select('id, room_id, property_id, hold_expires_at, guest_id')
      .eq('status', 'needs_review')
      .not('hold_expires_at', 'is', null)
      .lt('hold_expires_at', new Date().toISOString())

    if (fetchError) {
      console.error('Error fetching expired holds:', fetchError)
      throw fetchError
    }

    if (!expiredHolds || expiredHolds.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No expired holds found', released: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Found ${expiredHolds.length} expired holds to release`)

    // Cancel expired holds
    const expiredIds = expiredHolds.map(h => h.id)
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
        cancel_reason: 'Hold expired – auto-released by system',
        cancelled_at: new Date().toISOString(),
      })
      .in('id', expiredIds)

    if (updateError) {
      console.error('Error releasing holds:', updateError)
      throw updateError
    }

    // Also clean up room_availability entries for these bookings
    const { error: availError } = await supabase
      .from('room_availability')
      .delete()
      .in('booking_id', expiredIds)

    if (availError) {
      console.error('Error cleaning room availability:', availError)
    }

    // Log the release
    const logEntries = expiredHolds.map(h => ({
      property_id: h.property_id,
      provider: 'hold-timeout-release',
      parse_status: 'released',
      subject: `Auto-released booking ${h.id}`,
      raw_text: JSON.stringify({
        booking_id: h.id,
        room_id: h.room_id,
        hold_expires_at: h.hold_expires_at,
        released_at: new Date().toISOString(),
      }),
    }))

    await supabase.from('email_ingest_logs').insert(logEntries)

    return new Response(
      JSON.stringify({
        message: `Released ${expiredIds.length} expired holds`,
        released: expiredIds.length,
        booking_ids: expiredIds,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Hold timeout release error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

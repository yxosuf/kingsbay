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

    // Find rooms where cleaning timer has expired
    const { data: expiredRooms, error: fetchError } = await supabase
      .from('rooms')
      .select('id, room_number, property_id, cleaning_until')
      .eq('housekeeping_status', 'cleaning')
      .not('cleaning_until', 'is', null)
      .lt('cleaning_until', new Date().toISOString())

    if (fetchError) {
      console.error('Error fetching expired cleaning rooms:', fetchError)
      throw fetchError
    }

    if (!expiredRooms || expiredRooms.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No expired cleaning timers found', released: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Found ${expiredRooms.length} rooms with expired cleaning timers`)

    const expiredIds = expiredRooms.map(r => r.id)
    const { error: updateError } = await supabase
      .from('rooms')
      .update({
        housekeeping_status: 'clean',
        cleaning_until: null,
      })
      .in('id', expiredIds)

    if (updateError) {
      console.error('Error releasing cleaning rooms:', updateError)
      throw updateError
    }

    return new Response(
      JSON.stringify({
        message: `Released ${expiredIds.length} rooms from cleaning`,
        released: expiredIds.length,
        room_ids: expiredIds,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Cleaning timer release error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const now = new Date()
    const oneMonthAgo = new Date(now)
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
    const thirteenMonthsAgo = new Date(now)
    thirteenMonthsAgo.setMonth(thirteenMonthsAgo.getMonth() - 13)

    const oneMonthAgoStr = oneMonthAgo.toISOString().split('T')[0]
    const thirteenMonthsAgoStr = thirteenMonthsAgo.toISOString().split('T')[0]

    // Step 1: Soft-delete guests whose last checkout was > 13 months ago
    // Only target guests that are archived but not yet soft-deleted
    const { data: toDelete, error: deleteQueryError } = await supabase
      .from('guests')
      .select('id')
      .not('archived_at', 'is', null)
      .is('deleted_at', null)

    if (deleteQueryError) {
      console.error('Error querying guests for soft-delete:', deleteQueryError)
      throw deleteQueryError
    }

    let deletedCount = 0
    if (toDelete && toDelete.length > 0) {
      // Check each guest's last checkout
      for (const guest of toDelete) {
        const { data: lastBooking } = await supabase
          .from('bookings')
          .select('check_out')
          .eq('guest_id', guest.id)
          .in('status', ['checked_out', 'cancelled', 'no_show'])
          .order('check_out', { ascending: false })
          .limit(1)
          .maybeSingle()

        const lastCheckout = lastBooking?.check_out
        if (lastCheckout && lastCheckout < thirteenMonthsAgoStr) {
          const { error: updateError } = await supabase
            .from('guests')
            .update({ deleted_at: now.toISOString() })
            .eq('id', guest.id)

          if (!updateError) deletedCount++
        }
      }
    }

    // Step 2: Archive guests whose last checkout was > 1 month ago
    // Only target active guests (no archived_at, no deleted_at)
    const { data: toArchive, error: archiveQueryError } = await supabase
      .from('guests')
      .select('id')
      .is('archived_at', null)
      .is('deleted_at', null)

    if (archiveQueryError) {
      console.error('Error querying guests for archive:', archiveQueryError)
      throw archiveQueryError
    }

    let archivedCount = 0
    if (toArchive && toArchive.length > 0) {
      for (const guest of toArchive) {
        // Check if guest has any active bookings
        const { data: activeBooking } = await supabase
          .from('bookings')
          .select('id')
          .eq('guest_id', guest.id)
          .in('status', ['pending', 'confirmed', 'checked_in', 'needs_review'])
          .limit(1)
          .maybeSingle()

        if (activeBooking) continue // Skip guests with active bookings

        const { data: lastBooking } = await supabase
          .from('bookings')
          .select('check_out')
          .eq('guest_id', guest.id)
          .in('status', ['checked_out', 'cancelled', 'no_show'])
          .order('check_out', { ascending: false })
          .limit(1)
          .maybeSingle()

        const lastCheckout = lastBooking?.check_out
        if (lastCheckout && lastCheckout < oneMonthAgoStr) {
          const { error: updateError } = await supabase
            .from('guests')
            .update({ archived_at: now.toISOString() })
            .eq('id', guest.id)

          if (!updateError) archivedCount++
        }
      }
    }

    console.log(`Guest retention: archived ${archivedCount}, soft-deleted ${deletedCount}`)

    return new Response(
      JSON.stringify({
        message: `Archived ${archivedCount} guests, soft-deleted ${deletedCount} guests`,
        archived: archivedCount,
        deleted: deletedCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Guest retention error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

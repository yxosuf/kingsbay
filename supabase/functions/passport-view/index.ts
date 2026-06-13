import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'))

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }
    const userId = claimsData.claims.sub as string

    const { guest_id } = await req.json()
    if (!guest_id) {
      return new Response(JSON.stringify({ error: 'Missing guest_id' }), { status: 400, headers: corsHeaders })
    }

    // Verify access through RLS — if user can't see guest, this returns null
    const { data: guestData, error: guestError } = await userClient
      .from('guests')
      .select('id, property_id, passport_photo_path')
      .eq('id', guest_id)
      .single()

    if (guestError || !guestData) {
      return new Response(JSON.stringify({ error: 'Guest not found or access denied' }), { status: 404, headers: corsHeaders })
    }

    if (!guestData.passport_photo_path) {
      return new Response(JSON.stringify({ signed_url: null, deleted: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    // Check if there's an active (non-deleted) passport photo record
    const { data: photoRecord } = await adminClient
      .from('passport_photos')
      .select('id, deleted_at, scheduled_purge_at')
      .eq('guest_id', guest_id)
      .eq('storage_path', guestData.passport_photo_path)
      .single()

    if (photoRecord?.deleted_at) {
      const purgeDate = photoRecord.scheduled_purge_at
      return new Response(JSON.stringify({
        signed_url: null,
        deleted: true,
        purge_date: purgeDate,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Generate signed URL (5 min)
    const { data: signedUrlData } = await adminClient.storage
      .from('passports')
      .createSignedUrl(guestData.passport_photo_path, 300)

    // Log access in guest_view_logs
    await adminClient.from('guest_view_logs').insert({
      guest_id,
      user_id: userId,
      property_id: guestData.property_id,
    })

    return new Response(JSON.stringify({
      signed_url: signedUrlData?.signedUrl || null,
      deleted: false,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('Passport view error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: corsHeaders })
  }
})

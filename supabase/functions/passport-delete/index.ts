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

    // Admin check
    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const { data: roleData } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single()

    if (!roleData || roleData.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden: admin only' }), { status: 403, headers: corsHeaders })
    }

    const { guest_id } = await req.json()
    if (!guest_id) {
      return new Response(JSON.stringify({ error: 'Missing guest_id' }), { status: 400, headers: corsHeaders })
    }

    const now = new Date()
    const purgeAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000) // 3 months

    // Soft-delete all active passport photos for this guest
    const { data: photos } = await adminClient
      .from('passport_photos')
      .update({
        deleted_at: now.toISOString(),
        deleted_by: userId,
        scheduled_purge_at: purgeAt.toISOString(),
      })
      .eq('guest_id', guest_id)
      .is('deleted_at', null)
      .select()

    // Clear passport_photo_path on guest record
    await adminClient
      .from('guests')
      .update({ passport_photo_path: null, passport_photo_uploaded_at: null })
      .eq('id', guest_id)

    // Audit log
    await adminClient.from('audit_logs').insert({
      user_id: userId,
      action: 'passport_photo_delete',
      details: { guest_id, photos_soft_deleted: photos?.length || 0, purge_at: purgeAt.toISOString() },
    })

    return new Response(JSON.stringify({
      success: true,
      message: 'Photo marked for deletion. Will be permanently purged after 3 months.',
      purge_date: purgeAt.toISOString(),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('Passport delete error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: corsHeaders })
  }
})

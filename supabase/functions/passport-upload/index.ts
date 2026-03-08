import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// JPEG magic bytes: FF D8 FF
// PNG magic bytes: 89 50 4E 47
function validateMagicBytes(bytes: Uint8Array): { valid: boolean; mime: string } {
  if (bytes.length < 4) return { valid: false, mime: '' }
  
  // JPEG
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return { valid: true, mime: 'image/jpeg' }
  }
  
  // PNG
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return { valid: true, mime: 'image/png' }
  }
  
  return { valid: false, mime: '' }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // 1. Auth check
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // User client (respects RLS)
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }
    const userId = claimsData.claims.sub as string

    // Admin client (bypasses RLS for rate limits and storage)
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    // 2. Role check - must be write staff
    const { data: roleData } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single()

    if (!roleData || roleData.role === 'viewer') {
      return new Response(JSON.stringify({ error: 'Forbidden: insufficient permissions' }), { status: 403, headers: corsHeaders })
    }

    // 3. Rate limiting - max 3 uploads/hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { data: rateLimits } = await adminClient
      .from('upload_rate_limits')
      .select('id, request_count, window_start')
      .eq('user_id', userId)
      .eq('action_type', 'passport_upload')
      .gte('window_start', oneHourAgo)
      .order('window_start', { ascending: false })
      .limit(1)

    if (rateLimits && rateLimits.length > 0 && rateLimits[0].request_count >= 3) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Max 3 uploads per hour.' }), { status: 429, headers: corsHeaders })
    }

    // 4. Parse multipart form data
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const guestId = formData.get('guest_id') as string | null
    const propertyId = formData.get('property_id') as string | null

    if (!file || !guestId) {
      return new Response(JSON.stringify({ error: 'Missing file or guest_id' }), { status: 400, headers: corsHeaders })
    }

    // 5. File size check - max 5MB
    if (file.size > 5 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'File too large. Maximum 5MB.' }), { status: 400, headers: corsHeaders })
    }

    // 6. Magic bytes validation
    const fileBuffer = await file.arrayBuffer()
    const bytes = new Uint8Array(fileBuffer)
    const { valid, mime } = validateMagicBytes(bytes)

    if (!valid) {
      return new Response(JSON.stringify({ error: 'Invalid file type. Only JPEG and PNG are allowed.' }), { status: 400, headers: corsHeaders })
    }

    // 7. Verify guest exists and user can access
    const { data: guestData, error: guestError } = await userClient
      .from('guests')
      .select('id, property_id')
      .eq('id', guestId)
      .single()

    if (guestError || !guestData) {
      return new Response(JSON.stringify({ error: 'Guest not found or access denied' }), { status: 404, headers: corsHeaders })
    }

    // 8. Upload to passports bucket
    const ext = mime === 'image/png' ? 'png' : 'jpg'
    const fileId = crypto.randomUUID()
    const storagePath = `${propertyId || 'global'}/${guestId}/${fileId}.${ext}`

    const { error: uploadError } = await adminClient.storage
      .from('passports')
      .upload(storagePath, bytes, {
        contentType: mime,
        upsert: false,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return new Response(JSON.stringify({ error: 'Failed to upload file' }), { status: 500, headers: corsHeaders })
    }

    // 9. Soft-delete any existing passport photo record for this guest
    await adminClient
      .from('passport_photos')
      .update({ deleted_at: new Date().toISOString(), deleted_by: userId, scheduled_purge_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() })
      .eq('guest_id', guestId)
      .is('deleted_at', null)

    // 10. Insert passport_photos record
    await adminClient.from('passport_photos').insert({
      guest_id: guestId,
      property_id: propertyId,
      uploaded_by: userId,
      storage_path: storagePath,
      file_size: file.size,
      mime_type: mime,
    })

    // 11. Update guest record
    await adminClient
      .from('guests')
      .update({
        passport_photo_path: storagePath,
        passport_photo_uploaded_at: new Date().toISOString(),
      })
      .eq('id', guestId)

    // 12. Update rate limit
    if (rateLimits && rateLimits.length > 0) {
      await adminClient
        .from('upload_rate_limits')
        .update({ request_count: rateLimits[0].request_count + 1 })
        .eq('id', rateLimits[0].id)
    } else {
      await adminClient.from('upload_rate_limits').insert({
        user_id: userId,
        action_type: 'passport_upload',
        request_count: 1,
      })
    }

    // 13. Log in audit
    await adminClient.from('audit_logs').insert({
      user_id: userId,
      property_id: propertyId,
      action: 'passport_photo_upload',
      details: { guest_id: guestId, file_size: file.size, mime_type: mime },
    })

    // 14. Generate signed URL for immediate display
    const { data: signedUrlData } = await adminClient.storage
      .from('passports')
      .createSignedUrl(storagePath, 300) // 5 minutes

    return new Response(JSON.stringify({
      success: true,
      signed_url: signedUrlData?.signedUrl || null,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('Passport upload error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: corsHeaders })
  }
})

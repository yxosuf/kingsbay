import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'

function validateMagicBytes(bytes: Uint8Array): { valid: boolean; mime: string } {
  if (bytes.length < 4) return { valid: false, mime: '' }
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return { valid: true, mime: 'image/jpeg' }
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return { valid: true, mime: 'image/png' }
  return { valid: false, mime: '' }
}

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

    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    // Verify user is a guest with a linked guest record
    const { data: guestData, error: guestError } = await adminClient
      .from('guests')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    if (guestError || !guestData) {
      return new Response(JSON.stringify({ error: 'Guest profile not found' }), { status: 403, headers: corsHeaders })
    }

    // Parse form data
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const guestId = formData.get('guest_id') as string | null

    if (!file || !guestId) {
      return new Response(JSON.stringify({ error: 'Missing file or guest_id' }), { status: 400, headers: corsHeaders })
    }

    // Guest can only upload for themselves
    if (guestId !== guestData.id) {
      return new Response(JSON.stringify({ error: 'You can only upload your own passport photo' }), { status: 403, headers: corsHeaders })
    }

    // File size check - max 5MB
    if (file.size > 5 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: 'File too large. Maximum 5MB.' }), { status: 400, headers: corsHeaders })
    }

    // Magic bytes validation
    const fileBuffer = await file.arrayBuffer()
    const bytes = new Uint8Array(fileBuffer)
    const { valid, mime } = validateMagicBytes(bytes)

    if (!valid) {
      return new Response(JSON.stringify({ error: 'Invalid file type. Only JPEG and PNG are allowed.' }), { status: 400, headers: corsHeaders })
    }

    // Upload to passports bucket
    const ext = mime === 'image/png' ? 'png' : 'jpg'
    const fileId = crypto.randomUUID()
    const storagePath = `guest-uploads/${guestId}/${fileId}.${ext}`

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

    // Soft-delete existing passport photo records
    await adminClient
      .from('passport_photos')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: user.id,
        scheduled_purge_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq('guest_id', guestId)
      .is('deleted_at', null)

    // Insert new record
    await adminClient.from('passport_photos').insert({
      guest_id: guestId,
      uploaded_by: user.id,
      storage_path: storagePath,
      file_size: file.size,
      mime_type: mime,
    })

    // Update guest record
    await adminClient
      .from('guests')
      .update({
        passport_photo_path: storagePath,
        passport_photo_uploaded_at: new Date().toISOString(),
      })
      .eq('id', guestId)

    // Generate signed URL
    const { data: signedUrlData } = await adminClient.storage
      .from('passports')
      .createSignedUrl(storagePath, 300)

    return new Response(JSON.stringify({
      success: true,
      signed_url: signedUrlData?.signedUrl || null,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('Guest passport upload error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: corsHeaders })
  }
})

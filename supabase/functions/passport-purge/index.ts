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
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const now = new Date().toISOString()

    // Find photos due for purging
    const { data: photosToPurge, error: fetchError } = await adminClient
      .from('passport_photos')
      .select('id, storage_path, guest_id, property_id, deleted_by')
      .not('deleted_at', 'is', null)
      .lte('scheduled_purge_at', now)

    if (fetchError) {
      console.error('Error fetching photos to purge:', fetchError)
      return new Response(JSON.stringify({ error: 'Failed to fetch photos' }), { status: 500, headers: corsHeaders })
    }

    if (!photosToPurge || photosToPurge.length === 0) {
      return new Response(JSON.stringify({ message: 'No photos to purge', count: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let purgedCount = 0
    const errors: string[] = []

    for (const photo of photosToPurge) {
      try {
        // Delete from storage
        const { error: storageError } = await adminClient.storage
          .from('passports')
          .remove([photo.storage_path])

        if (storageError) {
          console.error(`Failed to delete storage file ${photo.storage_path}:`, storageError)
          errors.push(`Storage: ${photo.id}`)
          continue
        }

        // Delete record from passport_photos
        await adminClient
          .from('passport_photos')
          .delete()
          .eq('id', photo.id)

        // Audit log
        await adminClient.from('audit_logs').insert({
          user_id: photo.deleted_by || '00000000-0000-0000-0000-000000000000',
          property_id: photo.property_id,
          action: 'passport_photo_purged',
          details: { guest_id: photo.guest_id, storage_path: photo.storage_path },
        })

        purgedCount++
      } catch (err) {
        console.error(`Error purging photo ${photo.id}:`, err)
        errors.push(`Process: ${photo.id}`)
      }
    }

    return new Response(JSON.stringify({
      message: `Purged ${purgedCount} of ${photosToPurge.length} photos`,
      purged: purgedCount,
      errors: errors.length > 0 ? errors : undefined,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('Passport purge error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: corsHeaders })
  }
})

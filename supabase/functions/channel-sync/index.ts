import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // --- AUTH: Require valid JWT with admin/manager role ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;

    // Verify admin or manager role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (roleError || !roleData || !['admin', 'manager'].includes(roleData.role)) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions - admin or manager role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // --- END AUTH ---

    let propertyId: string | null = null;
    let channelId: string | null = null;

    try {
      const body = await req.json();
      propertyId = body.propertyId || null;
      channelId = body.channelId || null;
    } catch {
      // No body or invalid JSON is fine - sync all
    }

    console.log(`[Channel Sync] Starting sync - propertyId: ${propertyId}, channelId: ${channelId}, user: ${userId}`);

    let query = supabase
      .from('channel_connections')
      .select('id, property_id, channel_type, ical_import_url, sync_status')
      .eq('is_enabled', true)
      .not('ical_import_url', 'is', null);

    if (propertyId) {
      query = query.eq('property_id', propertyId);
    }
    if (channelId) {
      query = query.eq('id', channelId);
    }

    const { data: channels, error: channelsError } = await query;

    if (channelsError) {
      console.error('[Channel Sync] Error fetching channels:', channelsError);
      throw channelsError;
    }

    if (!channels || channels.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No channels configured for sync', channelsSynced: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Channel Sync] Found ${channels.length} channels to sync`);

    const results: { channelId: string; channelType: string; status: string; error?: string }[] = [];

    for (const channel of channels) {
      try {
        // Call ical-import with service role key (internal server-to-server)
        const importResponse = await fetch(`${supabaseUrl}/functions/v1/ical-import`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ channelId: channel.id }),
        });

        const importResult = await importResponse.json();

        if (importResponse.ok && importResult.success) {
          results.push({ channelId: channel.id, channelType: channel.channel_type, status: 'success' });
        } else {
          results.push({ channelId: channel.id, channelType: channel.channel_type, status: 'failed', error: importResult.error || 'Unknown error' });
        }
      } catch (error) {
        results.push({ channelId: channel.id, channelType: channel.channel_type, status: 'failed', error: error.message });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const failedCount = results.filter(r => r.status === 'failed').length;

    // Create notifications for failures
    if (failedCount > 0) {
      for (const failed of results.filter(r => r.status === 'failed')) {
        await supabase.from('notifications').insert({
          property_id: propertyId || null,
          type: 'channel_sync',
          category: 'channel_sync',
          priority: 'high',
          title: `${failed.channelType.replace('_', '.')} Sync Failed`,
          message: failed.error || 'Unknown sync error',
          link: '/channels',
          target_roles: ['admin', 'manager'],
          action_type: 'retry_sync',
          action_entity_id: failed.channelId,
        });
      }
    }

    if (successCount > 0 && failedCount === 0) {
      await supabase.from('notifications').insert({
        property_id: propertyId || null,
        type: 'channel_sync',
        category: 'channel_sync',
        priority: 'low',
        title: 'Channel Sync Complete',
        message: `${successCount} channel(s) synced successfully`,
        link: '/channels',
        target_roles: ['admin', 'manager'],
      });
    }

    return new Response(
      JSON.stringify({ success: true, channelsSynced: successCount, channelsFailed: failedCount, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Channel Sync] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

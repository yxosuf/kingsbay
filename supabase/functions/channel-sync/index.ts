import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body for optional filtering
    let propertyId: string | null = null;
    let channelId: string | null = null;

    try {
      const body = await req.json();
      propertyId = body.propertyId || null;
      channelId = body.channelId || null;
    } catch {
      // No body or invalid JSON is fine - sync all
    }

    console.log(`[Channel Sync] Starting sync - propertyId: ${propertyId}, channelId: ${channelId}`);

    // Build query for channels to sync
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
      console.log('[Channel Sync] No channels configured for sync');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No channels configured for sync',
          channelsSynced: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Channel Sync] Found ${channels.length} channels to sync`);

    const results: { channelId: string; channelType: string; status: string; error?: string }[] = [];

    // Sync each channel
    for (const channel of channels) {
      console.log(`[Channel Sync] Syncing channel: ${channel.id} (${channel.channel_type})`);
      
      try {
        // Call the iCal import function
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
          results.push({
            channelId: channel.id,
            channelType: channel.channel_type,
            status: 'success',
          });
          console.log(`[Channel Sync] Successfully synced ${channel.channel_type}`);
        } else {
          results.push({
            channelId: channel.id,
            channelType: channel.channel_type,
            status: 'failed',
            error: importResult.error || 'Unknown error',
          });
          console.error(`[Channel Sync] Failed to sync ${channel.channel_type}:`, importResult.error);
        }
      } catch (error) {
        results.push({
          channelId: channel.id,
          channelType: channel.channel_type,
          status: 'failed',
          error: error.message,
        });
        console.error(`[Channel Sync] Error syncing ${channel.channel_type}:`, error);
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const failedCount = results.filter(r => r.status === 'failed').length;

    console.log(`[Channel Sync] Completed - Success: ${successCount}, Failed: ${failedCount}`);

    // Create notifications for sync results
    if (failedCount > 0) {
      const failedChannels = results.filter(r => r.status === 'failed');
      for (const failed of failedChannels) {
        await supabase
          .from('notifications')
          .insert({
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
      // Only notify on all-success if there were channels synced
      await supabase
        .from('notifications')
        .insert({
          property_id: propertyId || null,
          type: 'channel_sync',
          category: 'channel_sync',
          priority: 'low',
          title: `Channel Sync Complete`,
          message: `${successCount} channel(s) synced successfully`,
          link: '/channels',
          target_roles: ['admin', 'manager'],
        });
    }

    return new Response(
      JSON.stringify({
        success: true,
        channelsSynced: successCount,
        channelsFailed: failedCount,
        results,
      }),
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

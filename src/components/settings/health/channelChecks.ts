import { createElement } from 'react';
import { Radio, RefreshCw, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { HealthCheck } from './types';

export async function runChannelChecks(propertyId: string | null): Promise<HealthCheck[]> {
  const results: HealthCheck[] = [];
  if (!propertyId) {
    results.push({ name: 'Channel Connections', description: 'Select a property to check channels', status: 'warn', detail: 'No property selected', icon: createElement(Radio, { className: 'h-4 w-4' }) });
    return results;
  }

  // Channel connections count
  try {
    const { data: channels } = await supabase.from('channel_connections').select('id, channel_type, is_enabled, last_sync_at').eq('property_id', propertyId);
    const enabled = channels?.filter(c => c.is_enabled) || [];
    results.push({ name: 'Channel Connections', description: 'Active channel integrations', status: enabled.length > 0 ? 'pass' : 'warn', detail: enabled.length > 0 ? `${enabled.length} active channel(s): ${enabled.map(c => c.channel_type).join(', ')}` : 'No active channel connections', icon: createElement(Radio, { className: 'h-4 w-4' }) });

    // Last sync freshness
    if (enabled.length > 0) {
      const staleChannels = enabled.filter(c => {
        if (!c.last_sync_at) return true;
        const age = (Date.now() - new Date(c.last_sync_at).getTime()) / (1000 * 60 * 60);
        return age > 24;
      });
      results.push({ name: 'Last Sync Freshness', description: 'All channels synced within 24h', status: staleChannels.length === 0 ? 'pass' : 'warn', detail: staleChannels.length === 0 ? 'All channels synced recently' : `${staleChannels.length} channel(s) not synced in 24h+`, icon: createElement(RefreshCw, { className: 'h-4 w-4' }) });
    }
  } catch {
    results.push({ name: 'Channel Connections', description: 'Channel integrations', status: 'fail', detail: 'Could not query channels', icon: createElement(Radio, { className: 'h-4 w-4' }) });
  }

  // Sync errors in last 7 days
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase.from('sync_logs').select('id', { count: 'exact', head: true }).eq('status', 'failed').gte('created_at', weekAgo);
    const cnt = count || 0;
    results.push({ name: 'Sync Errors (7d)', description: 'Failed syncs in the last 7 days', status: cnt === 0 ? 'pass' : cnt <= 3 ? 'warn' : 'fail', detail: cnt === 0 ? 'No sync errors' : `${cnt} failed sync(s) in 7 days`, icon: createElement(AlertTriangle, { className: 'h-4 w-4' }) });
  } catch {
    results.push({ name: 'Sync Errors (7d)', description: 'Sync errors', status: 'fail', detail: 'Could not query sync logs', icon: createElement(AlertTriangle, { className: 'h-4 w-4' }) });
  }

  return results;
}

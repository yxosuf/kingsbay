import { createElement } from 'react';
import { Timer, Brush } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { HealthCheck } from './types';

export async function runHousekeepingChecks(propertyId: string | null): Promise<HealthCheck[]> {
  const results: HealthCheck[] = [];

  // Stuck cleaning rooms
  try {
    let query = supabase.from('rooms').select('id, room_number, cleaning_until').eq('housekeeping_status', 'cleaning');
    if (propertyId) query = query.eq('property_id', propertyId);
    const { data: cleaningRooms } = await query;
    const now = new Date();
    const stuck = (cleaningRooms || []).filter(r => r.cleaning_until && new Date(r.cleaning_until) < now);
    results.push({ name: 'Stuck Cleaning', description: 'No rooms past their cleaning deadline', status: stuck.length === 0 ? 'pass' : 'warn', detail: stuck.length === 0 ? `${cleaningRooms?.length || 0} room(s) currently cleaning, none stuck` : `${stuck.length} room(s) past cleaning deadline: ${stuck.map(r => r.room_number).join(', ')}`, icon: createElement(Timer, { className: 'h-4 w-4' }) });
  } catch {
    results.push({ name: 'Stuck Cleaning', description: 'Rooms past cleaning deadline', status: 'fail', detail: 'Could not query rooms', icon: createElement(Timer, { className: 'h-4 w-4' }) });
  }

  // Dirty room backlog
  try {
    let query = supabase.from('rooms').select('id', { count: 'exact', head: true }).eq('housekeeping_status', 'dirty');
    if (propertyId) query = query.eq('property_id', propertyId);
    const { count: dirtyCount } = await query;

    let query2 = supabase.from('rooms').select('id', { count: 'exact', head: true }).eq('housekeeping_status', 'dirty').is('assigned_to', null);
    if (propertyId) query2 = query2.eq('property_id', propertyId);
    const { count: unassigned } = await query2;

    const dirty = dirtyCount || 0;
    const notAssigned = unassigned || 0;
    results.push({ name: 'Dirty Room Backlog', description: 'Dirty rooms assigned for cleaning', status: dirty === 0 ? 'pass' : notAssigned === 0 ? 'pass' : 'warn', detail: dirty === 0 ? 'No dirty rooms' : `${dirty} dirty room(s), ${notAssigned} unassigned`, icon: createElement(Brush, { className: 'h-4 w-4' }) });
  } catch {
    results.push({ name: 'Dirty Room Backlog', description: 'Dirty rooms', status: 'fail', detail: 'Could not query rooms', icon: createElement(Brush, { className: 'h-4 w-4' }) });
  }

  return results;
}

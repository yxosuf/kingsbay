import { createElement } from 'react';
import { Layers, UserX, Clock, BarChart3, Tag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toDateString } from '@/lib/dateUtils';
import type { HealthCheck } from './types';

export async function runBookingChecks(propertyId: string | null): Promise<HealthCheck[]> {
  const results: HealthCheck[] = [];

  // Overlap prevention
  try {
    let query = supabase.from('bookings').select('id, room_id, check_in, check_out, status').in('status', ['confirmed', 'pending', 'checked_in', 'needs_review']).order('room_id').order('check_in');
    if (propertyId) query = query.eq('property_id', propertyId);
    const { data: activeBookings } = await query;
    let overlapCount = 0;
    if (activeBookings && activeBookings.length > 1) {
      for (let i = 0; i < activeBookings.length - 1; i++) {
        if (activeBookings[i].room_id === activeBookings[i + 1].room_id && activeBookings[i].check_out > activeBookings[i + 1].check_in) overlapCount++;
      }
    }
    results.push({ name: 'Overlap Prevention', description: 'No double-booked rooms in active bookings', status: overlapCount === 0 ? 'pass' : 'fail', detail: overlapCount === 0 ? `${activeBookings?.length || 0} active bookings, no overlaps` : `${overlapCount} overlapping booking(s) detected!`, icon: createElement(Layers, { className: 'h-4 w-4' }) });
  } catch {
    results.push({ name: 'Overlap Prevention', description: 'No double-booked rooms', status: 'fail', detail: 'Could not query bookings', icon: createElement(Layers, { className: 'h-4 w-4' }) });
  }

  // Orphan bookings (missing guest/room refs)
  try {
    let query = supabase.from('bookings').select('id', { count: 'exact', head: true }).is('guest_id', null);
    if (propertyId) query = query.eq('property_id', propertyId);
    const { count: orphanGuest } = await query;

    let query2 = supabase.from('bookings').select('id', { count: 'exact', head: true }).is('room_id', null);
    if (propertyId) query2 = query2.eq('property_id', propertyId);
    const { count: orphanRoom } = await query2;

    const total = (orphanGuest || 0) + (orphanRoom || 0);
    results.push({ name: 'Orphan Bookings', description: 'All bookings have valid guest and room references', status: total === 0 ? 'pass' : 'fail', detail: total === 0 ? 'All bookings properly linked' : `${orphanGuest || 0} missing guest, ${orphanRoom || 0} missing room`, icon: createElement(UserX, { className: 'h-4 w-4' }) });
  } catch {
    results.push({ name: 'Orphan Bookings', description: 'All bookings have valid references', status: 'fail', detail: 'Could not query bookings', icon: createElement(UserX, { className: 'h-4 w-4' }) });
  }

  // Stale pending bookings (>48h old)
  try {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    let query = supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'pending').lt('created_at', cutoff);
    if (propertyId) query = query.eq('property_id', propertyId);
    const { count: staleCount } = await query;
    results.push({ name: 'Stale Pending Bookings', description: 'No pending bookings older than 48 hours', status: (staleCount || 0) === 0 ? 'pass' : 'warn', detail: (staleCount || 0) === 0 ? 'No stale pending bookings' : `${staleCount} pending booking(s) older than 48h`, icon: createElement(Clock, { className: 'h-4 w-4' }) });
  } catch {
    results.push({ name: 'Stale Pending Bookings', description: 'No stale pending bookings', status: 'fail', detail: 'Could not query bookings', icon: createElement(Clock, { className: 'h-4 w-4' }) });
  }

  // Price breakdown coverage
  try {
    let qTotal = supabase.from('bookings').select('id', { count: 'exact', head: true }).in('status', ['confirmed', 'checked_in', 'checked_out', 'pending']);
    if (propertyId) qTotal = qTotal.eq('property_id', propertyId);
    const { count: totalCount } = await qTotal;

    let qWithBreakdown = supabase.from('bookings').select('id', { count: 'exact', head: true }).in('status', ['confirmed', 'checked_in', 'checked_out', 'pending']).not('price_breakdown', 'is', null);
    if (propertyId) qWithBreakdown = qWithBreakdown.eq('property_id', propertyId);
    const { count: withBreakdown } = await qWithBreakdown;

    const total = totalCount || 0;
    const covered = withBreakdown || 0;
    const pct = total > 0 ? Math.round((covered / total) * 100) : 100;
    results.push({ name: 'Price Breakdown Coverage', description: 'Bookings with stored nightly breakdown', status: pct >= 90 ? 'pass' : pct >= 50 ? 'warn' : 'fail', detail: `${covered}/${total} bookings (${pct}%) have price breakdown`, icon: createElement(BarChart3, { className: 'h-4 w-4' }) });
  } catch {
    results.push({ name: 'Price Breakdown Coverage', description: 'Bookings with price breakdown', status: 'fail', detail: 'Could not query bookings', icon: createElement(BarChart3, { className: 'h-4 w-4' }) });
  }

  // Discount usage integrity
  try {
    const { count: usageCount } = await supabase.from('discount_code_usages').select('id', { count: 'exact', head: true });
    let qDiscounted = supabase.from('bookings').select('id', { count: 'exact', head: true }).not('discount_code_id', 'is', null);
    if (propertyId) qDiscounted = qDiscounted.eq('property_id', propertyId);
    const { count: discountedBookings } = await qDiscounted;
    const usages = usageCount || 0;
    const bookings = discountedBookings || 0;
    results.push({ name: 'Discount Usage Integrity', description: 'Discount usage records match bookings', status: usages >= bookings ? 'pass' : 'warn', detail: `${bookings} discounted bookings, ${usages} usage records`, icon: createElement(Tag, { className: 'h-4 w-4' }) });
  } catch {
    results.push({ name: 'Discount Usage Integrity', description: 'Discount records match', status: 'fail', detail: 'Could not query discount data', icon: createElement(Tag, { className: 'h-4 w-4' }) });
  }

  return results;
}

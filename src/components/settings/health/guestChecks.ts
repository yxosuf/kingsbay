import { createElement } from 'react';
import { UserCheck, Fingerprint, UserMinus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { HealthCheck } from './types';

export async function runGuestChecks(propertyId: string | null): Promise<HealthCheck[]> {
  const results: HealthCheck[] = [];

  // Guest completeness (email or phone)
  try {
    let qTotal = supabase.from('guests').select('id', { count: 'exact', head: true }).is('deleted_at', null);
    if (propertyId) qTotal = qTotal.eq('property_id', propertyId);
    const { count: totalCount } = await qTotal;

    // Guests with at least email OR phone
    let qWithContact = supabase.from('guests').select('id, email, phone').is('deleted_at', null);
    if (propertyId) qWithContact = qWithContact.eq('property_id', propertyId);
    const { data: guests } = await qWithContact;

    const total = totalCount || 0;
    const withContact = (guests || []).filter(g => g.email || g.phone).length;
    const pct = total > 0 ? Math.round((withContact / total) * 100) : 100;
    results.push({ name: 'Guest Completeness', description: 'Guests with email or phone', status: pct >= 80 ? 'pass' : pct >= 50 ? 'warn' : 'fail', detail: `${withContact}/${total} guests (${pct}%) have contact info`, icon: createElement(UserCheck, { className: 'h-4 w-4' }) });
  } catch {
    results.push({ name: 'Guest Completeness', description: 'Guest contact data', status: 'fail', detail: 'Could not query guests', icon: createElement(UserCheck, { className: 'h-4 w-4' }) });
  }

  // Passport compliance for foreign guests
  try {
    let query = supabase.from('guests').select('id, passport_number, passport_photo_path').eq('guest_type', 'foreign').is('deleted_at', null);
    if (propertyId) query = query.eq('property_id', propertyId);
    const { data: foreignGuests } = await query;
    const total = foreignGuests?.length || 0;
    const missingPassport = (foreignGuests || []).filter(g => !g.passport_number).length;
    results.push({ name: 'Passport Compliance', description: 'Foreign guests with passport data', status: missingPassport === 0 ? 'pass' : 'warn', detail: total === 0 ? 'No foreign guests' : missingPassport === 0 ? `${total} foreign guest(s), all have passport data` : `${missingPassport}/${total} foreign guest(s) missing passport number`, icon: createElement(Fingerprint, { className: 'h-4 w-4' }) });
  } catch {
    results.push({ name: 'Passport Compliance', description: 'Passport data', status: 'fail', detail: 'Could not query guests', icon: createElement(Fingerprint, { className: 'h-4 w-4' }) });
  }

  // Orphan guests (no bookings)
  try {
    let query = supabase.from('guests').select('id').is('deleted_at', null).eq('total_stays', 0);
    if (propertyId) query = query.eq('property_id', propertyId);
    const { data: orphans } = await query;
    const cnt = orphans?.length || 0;
    results.push({ name: 'Orphan Guests', description: 'Guests with zero bookings', status: cnt === 0 ? 'pass' : cnt <= 5 ? 'warn' : 'fail', detail: cnt === 0 ? 'All guests have bookings' : `${cnt} guest(s) with zero stays`, icon: createElement(UserMinus, { className: 'h-4 w-4' }) });
  } catch {
    results.push({ name: 'Orphan Guests', description: 'Guests without bookings', status: 'fail', detail: 'Could not query guests', icon: createElement(UserMinus, { className: 'h-4 w-4' }) });
  }

  return results;
}

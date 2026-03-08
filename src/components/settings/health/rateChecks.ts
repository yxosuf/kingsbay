import { createElement } from 'react';
import { TrendingUp, CalendarRange, CalendarX, Percent, BarChart } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toDateString } from '@/lib/dateUtils';
import type { HealthCheck } from './types';

export async function runRateChecks(propertyId: string | null): Promise<HealthCheck[]> {
  const results: HealthCheck[] = [];
  if (!propertyId) {
    results.push({ name: 'Rate Plans Active', description: 'Select a property to check rate engine', status: 'warn', detail: 'No property selected', icon: createElement(TrendingUp, { className: 'h-4 w-4' }) });
    return results;
  }

  // Rate plans active
  try {
    const { count } = await supabase.from('rate_plans').select('id', { count: 'exact', head: true }).eq('property_id', propertyId).eq('is_active', true);
    const cnt = count || 0;
    results.push({ name: 'Rate Plans Active', description: 'At least 1 active rate plan exists', status: cnt > 0 ? 'pass' : 'warn', detail: cnt > 0 ? `${cnt} active rate plan(s)` : 'No active rate plans — using base room prices', icon: createElement(TrendingUp, { className: 'h-4 w-4' }) });
  } catch {
    results.push({ name: 'Rate Plans Active', description: 'Active rate plans exist', status: 'fail', detail: 'Could not query rate plans', icon: createElement(TrendingUp, { className: 'h-4 w-4' }) });
  }

  // Seasonal rules — expired but active
  try {
    const today = toDateString(new Date());
    const { data: expired } = await supabase.from('seasonal_rules').select('id, name').eq('property_id', propertyId).eq('is_active', true).lt('end_date', today);
    const cnt = expired?.length || 0;
    results.push({ name: 'Seasonal Rules Valid', description: 'No expired seasonal rules still active', status: cnt === 0 ? 'pass' : 'warn', detail: cnt === 0 ? 'All active seasonal rules are current' : `${cnt} expired rule(s) still marked active`, icon: createElement(CalendarRange, { className: 'h-4 w-4' }) });
  } catch {
    results.push({ name: 'Seasonal Rules Valid', description: 'Seasonal rules valid', status: 'fail', detail: 'Could not query seasonal rules', icon: createElement(CalendarRange, { className: 'h-4 w-4' }) });
  }

  // Stale rate overrides (past closed dates)
  try {
    const today = toDateString(new Date());
    const { count } = await supabase.from('rate_overrides').select('id', { count: 'exact', head: true }).eq('property_id', propertyId).eq('closed', true).lt('date', today);
    const cnt = count || 0;
    results.push({ name: 'Rate Overrides Consistency', description: 'No stale closed overrides for past dates', status: cnt === 0 ? 'pass' : 'warn', detail: cnt === 0 ? 'No stale overrides' : `${cnt} closed override(s) for past dates`, icon: createElement(CalendarX, { className: 'h-4 w-4' }) });
  } catch {
    results.push({ name: 'Rate Overrides Consistency', description: 'Rate overrides clean', status: 'fail', detail: 'Could not query overrides', icon: createElement(CalendarX, { className: 'h-4 w-4' }) });
  }

  // Expired discount codes still active
  try {
    const today = toDateString(new Date());
    const { count } = await supabase.from('discount_codes').select('id', { count: 'exact', head: true }).eq('property_id', propertyId).eq('is_active', true).lt('end_date', today);
    const cnt = count || 0;
    results.push({ name: 'Discount Codes', description: 'No expired discount codes still active', status: cnt === 0 ? 'pass' : 'warn', detail: cnt === 0 ? 'All active codes are current' : `${cnt} expired code(s) still active`, icon: createElement(Percent, { className: 'h-4 w-4' }) });
  } catch {
    results.push({ name: 'Discount Codes', description: 'Discount codes valid', status: 'fail', detail: 'Could not query discount codes', icon: createElement(Percent, { className: 'h-4 w-4' }) });
  }

  // Occupancy rules — duplicate thresholds
  try {
    const { data: rules } = await supabase.from('occupancy_pricing_rules').select('occupancy_threshold').eq('property_id', propertyId).eq('is_active', true).order('occupancy_threshold');
    if (rules && rules.length > 0) {
      const thresholds = rules.map(r => r.occupancy_threshold);
      const dupes = thresholds.length !== new Set(thresholds).size;
      results.push({ name: 'Occupancy Rules', description: 'Thresholds are unique and ordered', status: dupes ? 'warn' : 'pass', detail: dupes ? 'Duplicate occupancy thresholds found' : `${rules.length} rule(s), thresholds valid`, icon: createElement(BarChart, { className: 'h-4 w-4' }) });
    } else {
      results.push({ name: 'Occupancy Rules', description: 'Occupancy pricing rules', status: 'pass', detail: 'No occupancy rules configured', icon: createElement(BarChart, { className: 'h-4 w-4' }) });
    }
  } catch {
    results.push({ name: 'Occupancy Rules', description: 'Occupancy rules valid', status: 'fail', detail: 'Could not query rules', icon: createElement(BarChart, { className: 'h-4 w-4' }) });
  }

  return results;
}

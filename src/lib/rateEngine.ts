/**
 * Rate Management Pricing Engine
 * 
 * Central pricing logic used by booking creation, rate calendar, and reports.
 * 
 * Calculation order per night:
 * 1. Base price from rate_plan (or room.price fallback)
 * 2. Room type override from rate_plan_room_types
 * 3. Manual override from rate_overrides (replaces everything)
 * 4. Seasonal modifier (percent or fixed)
 * 5. Day-of-week modifier (percent or fixed)
 * 6. Extra guest fee if guests > included_guests
 */

import { supabase } from '@/integrations/supabase/client';
import { parseLocalDate, toDateString } from '@/lib/dateUtils';
import { eachDayOfInterval } from 'date-fns';

export interface RatePlan {
  id: string;
  name: string;
  base_price: number;
  is_refundable: boolean;
  min_stay: number;
  max_stay: number | null;
  included_guests: number;
  extra_guest_fee: number;
  is_active: boolean;
}

export interface SeasonalRule {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  modifier_type: 'percent' | 'fixed';
  modifier_value: number;
  priority: number;
  rate_plan_id: string | null;
}

export interface DayOfWeekRule {
  id: string;
  day_of_week: number;
  modifier_type: 'percent' | 'fixed';
  modifier_value: number;
  rate_plan_id: string | null;
}

export interface RateOverride {
  date: string;
  price: number;
  closed: boolean;
  min_stay: number | null;
}

export interface NightBreakdown {
  date: string;
  basePrice: number;
  finalPrice: number;
  override: boolean;
  seasonal: string | null;
  dayOfWeek: boolean;
  closed: boolean;
}

export interface StayTotal {
  nights: NightBreakdown[];
  subtotal: number;
  discount: number;
  discountCode: string | null;
  total: number;
  ratePlanName: string | null;
  extraGuestFee: number;
}

/**
 * Apply a modifier to a base price.
 */
function applyModifier(price: number, type: 'percent' | 'fixed', value: number): number {
  if (type === 'percent') {
    return price + (price * value) / 100;
  }
  return price + value;
}

/**
 * Fetch all rate data needed for calculation in a single batch.
 */
export async function fetchRateData(propertyId: string) {
  const [
    { data: ratePlans },
    { data: roomTypeOverrides },
    { data: seasonalRules },
    { data: dayOfWeekRules },
  ] = await Promise.all([
    supabase
      .from('rate_plans')
      .select('*')
      .eq('property_id', propertyId)
      .eq('is_active', true),
    supabase
      .from('rate_plan_room_types')
      .select('*'),
    supabase
      .from('seasonal_rules')
      .select('*')
      .eq('property_id', propertyId)
      .eq('is_active', true)
      .order('priority', { ascending: false }),
    supabase
      .from('day_of_week_rules')
      .select('*')
      .eq('property_id', propertyId)
      .eq('is_active', true),
  ]);

  return {
    ratePlans: (ratePlans || []) as any[],
    roomTypeOverrides: (roomTypeOverrides || []) as any[],
    seasonalRules: (seasonalRules || []) as SeasonalRule[],
    dayOfWeekRules: (dayOfWeekRules || []) as DayOfWeekRule[],
  };
}

/**
 * Fetch rate overrides for a date range.
 */
export async function fetchOverrides(propertyId: string, roomType: string, startDate: string, endDate: string) {
  const { data } = await supabase
    .from('rate_overrides')
    .select('date, price, closed, min_stay')
    .eq('property_id', propertyId)
    .eq('room_type', roomType)
    .gte('date', startDate)
    .lte('date', endDate);

  const map = new Map<string, RateOverride>();
  (data || []).forEach((o: any) => map.set(o.date, o));
  return map;
}

/**
 * Calculate the nightly rate for a single date.
 */
export function calculateNightRate(
  dateStr: string,
  basePrice: number,
  roomType: string,
  ratePlan: RatePlan | null,
  roomTypeOverrides: any[],
  seasonalRules: SeasonalRule[],
  dayOfWeekRules: DayOfWeekRule[],
  overrides: Map<string, RateOverride>,
  guestCount: number = 2,
): NightBreakdown {
  // 1. Start with base price
  let price = ratePlan ? ratePlan.base_price : basePrice;

  // 2. Check room type override
  if (ratePlan) {
    const rto = roomTypeOverrides.find(
      (o: any) => o.rate_plan_id === ratePlan.id && o.room_type === roomType
    );
    if (rto?.price_override != null) {
      price = rto.price_override;
    }
  }

  // 3. Check manual override — replaces everything
  const override = overrides.get(dateStr);
  if (override) {
    return {
      date: dateStr,
      basePrice: price,
      finalPrice: override.price,
      override: true,
      seasonal: null,
      dayOfWeek: false,
      closed: override.closed,
    };
  }

  // 4. Apply seasonal rule (highest priority match)
  let seasonalName: string | null = null;
  const matchingSeason = seasonalRules.find(
    (s) =>
      dateStr >= s.start_date &&
      dateStr <= s.end_date &&
      (s.rate_plan_id === null || (ratePlan && s.rate_plan_id === ratePlan.id))
  );
  if (matchingSeason) {
    price = applyModifier(price, matchingSeason.modifier_type as 'percent' | 'fixed', matchingSeason.modifier_value);
    seasonalName = matchingSeason.name;
  }

  // 5. Apply day-of-week rule
  const date = parseLocalDate(dateStr);
  const dayOfWeek = date.getDay();
  let dayOfWeekApplied = false;
  const matchingDay = dayOfWeekRules.find(
    (d) =>
      d.day_of_week === dayOfWeek &&
      (d.rate_plan_id === null || (ratePlan && d.rate_plan_id === ratePlan.id))
  );
  if (matchingDay) {
    price = applyModifier(price, matchingDay.modifier_type as 'percent' | 'fixed', matchingDay.modifier_value);
    dayOfWeekApplied = true;
  }

  // 6. Extra guest fee
  if (ratePlan && guestCount > ratePlan.included_guests) {
    const extraGuests = guestCount - ratePlan.included_guests;
    price += extraGuests * ratePlan.extra_guest_fee;
  }

  return {
    date: dateStr,
    basePrice: ratePlan ? ratePlan.base_price : basePrice,
    finalPrice: Math.round(price * 100) / 100,
    override: false,
    seasonal: seasonalName,
    dayOfWeek: dayOfWeekApplied,
    closed: false,
  };
}

/**
 * Calculate the total for a stay.
 */
export async function calculateStayTotal(
  propertyId: string,
  roomType: string,
  roomBasePrice: number,
  checkIn: string,
  checkOut: string,
  ratePlanId?: string | null,
  guestCount: number = 2,
  discountCode?: string | null,
): Promise<StayTotal> {
  const rateData = await fetchRateData(propertyId);
  const overrides = await fetchOverrides(propertyId, roomType, checkIn, checkOut);

  const ratePlan = ratePlanId
    ? rateData.ratePlans.find((rp: any) => rp.id === ratePlanId) || null
    : null;

  // Generate date range [checkIn, checkOut)
  const startDate = parseLocalDate(checkIn);
  const endDate = parseLocalDate(checkOut);
  const dates = eachDayOfInterval({
    start: startDate,
    end: new Date(endDate.getTime() - 86400000),
  });

  const nights: NightBreakdown[] = dates.map((d) => {
    const dateStr = toDateString(d);
    return calculateNightRate(
      dateStr,
      roomBasePrice,
      roomType,
      ratePlan,
      rateData.roomTypeOverrides,
      rateData.seasonalRules,
      rateData.dayOfWeekRules,
      overrides,
      guestCount,
    );
  });

  const subtotal = nights.reduce((sum, n) => sum + n.finalPrice, 0);
  const extraGuestFee = ratePlan && guestCount > ratePlan.included_guests
    ? (guestCount - ratePlan.included_guests) * ratePlan.extra_guest_fee * nights.length
    : 0;

  // Discount code validation
  let discount = 0;
  let appliedCode: string | null = null;

  if (discountCode) {
    const { data: dc } = await supabase
      .from('discount_codes')
      .select('*')
      .eq('property_id', propertyId)
      .eq('code', discountCode.toUpperCase())
      .eq('is_active', true)
      .single();

    if (dc) {
      const today = toDateString(new Date());
      const validStart = !dc.start_date || today >= dc.start_date;
      const validEnd = !dc.end_date || today <= dc.end_date;

      if (validStart && validEnd) {
        // Check usage limit
        if (dc.max_usage) {
          const { count } = await supabase
            .from('discount_code_usages')
            .select('*', { count: 'exact', head: true })
            .eq('discount_code_id', dc.id);

          if ((count || 0) >= dc.max_usage) {
            // Code exhausted — don't apply
          } else {
            appliedCode = dc.code;
            discount = dc.discount_type === 'percent'
              ? (subtotal * dc.discount_value) / 100
              : dc.discount_value;
          }
        } else {
          appliedCode = dc.code;
          discount = dc.discount_type === 'percent'
            ? (subtotal * dc.discount_value) / 100
            : dc.discount_value;
        }
      }
    }
  }

  return {
    nights,
    subtotal: Math.round(subtotal * 100) / 100,
    discount: Math.round(discount * 100) / 100,
    discountCode: appliedCode,
    total: Math.round((subtotal - discount) * 100) / 100,
    ratePlanName: ratePlan?.name || null,
    extraGuestFee: Math.round(extraGuestFee * 100) / 100,
  };
}

/**
 * Get available rate plans for a property.
 */
export async function getActiveRatePlans(propertyId: string) {
  const { data } = await supabase
    .from('rate_plans')
    .select('*, rate_plan_room_types(*)')
    .eq('property_id', propertyId)
    .eq('is_active', true)
    .order('name');

  return data || [];
}

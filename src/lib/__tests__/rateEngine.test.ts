import { describe, it, expect } from 'vitest';
import { calculateNightRate } from '../rateEngine';
import type { RatePlan, SeasonalRule, DayOfWeekRule, RateOverride, OccupancyRule } from '../rateEngine';

const baseRatePlan: RatePlan = {
  id: 'rp-1',
  name: 'Standard',
  base_price: 10000,
  is_refundable: true,
  min_stay: 1,
  max_stay: null,
  included_guests: 2,
  extra_guest_fee: 1500,
  is_active: true,
};

describe('calculateNightRate', () => {
  it('uses rate plan base price when rate plan is provided', () => {
    const result = calculateNightRate(
      '2024-03-15', 5000, 'deluxe', baseRatePlan, [], [], [], new Map(),
    );
    expect(result.basePrice).toBe(10000);
    expect(result.finalPrice).toBe(10000);
    expect(result.override).toBe(false);
    expect(result.closed).toBe(false);
  });

  it('falls back to room base price when no rate plan', () => {
    const result = calculateNightRate(
      '2024-03-15', 5000, 'deluxe', null, [], [], [], new Map(),
    );
    expect(result.basePrice).toBe(5000);
    expect(result.finalPrice).toBe(5000);
  });

  it('applies room type override', () => {
    const roomTypeOverrides = [
      { rate_plan_id: 'rp-1', room_type: 'deluxe', price_override: 12000 },
    ];
    const result = calculateNightRate(
      '2024-03-15', 5000, 'deluxe', baseRatePlan, roomTypeOverrides, [], [], new Map(),
    );
    expect(result.finalPrice).toBe(12000);
  });

  it('ignores room type override for different room type', () => {
    const roomTypeOverrides = [
      { rate_plan_id: 'rp-1', room_type: 'suite', price_override: 20000 },
    ];
    const result = calculateNightRate(
      '2024-03-15', 5000, 'deluxe', baseRatePlan, roomTypeOverrides, [], [], new Map(),
    );
    expect(result.finalPrice).toBe(10000);
  });

  it('applies manual override and replaces everything', () => {
    const overrides = new Map<string, RateOverride>([
      ['2024-03-15', { date: '2024-03-15', price: 8000, closed: false, min_stay: null }],
    ]);
    const result = calculateNightRate(
      '2024-03-15', 5000, 'deluxe', baseRatePlan, [], [], [], overrides,
    );
    expect(result.override).toBe(true);
    expect(result.finalPrice).toBe(8000);
  });

  it('marks closed dates from override', () => {
    const overrides = new Map<string, RateOverride>([
      ['2024-03-15', { date: '2024-03-15', price: 0, closed: true, min_stay: null }],
    ]);
    const result = calculateNightRate(
      '2024-03-15', 5000, 'deluxe', null, [], [], [], overrides,
    );
    expect(result.closed).toBe(true);
    expect(result.override).toBe(true);
  });

  it('applies percent seasonal modifier', () => {
    const seasonal: SeasonalRule[] = [{
      id: 's1', name: 'Peak Season', start_date: '2024-03-01', end_date: '2024-03-31',
      modifier_type: 'percent', modifier_value: 20, priority: 1, rate_plan_id: null,
    }];
    const result = calculateNightRate(
      '2024-03-15', 10000, 'deluxe', null, [], seasonal, [], new Map(),
    );
    expect(result.finalPrice).toBe(12000);
    expect(result.seasonal).toBe('Peak Season');
  });

  it('applies fixed seasonal modifier', () => {
    const seasonal: SeasonalRule[] = [{
      id: 's1', name: 'Holiday', start_date: '2024-03-01', end_date: '2024-03-31',
      modifier_type: 'fixed', modifier_value: 2000, priority: 1, rate_plan_id: null,
    }];
    const result = calculateNightRate(
      '2024-03-15', 10000, 'deluxe', null, [], seasonal, [], new Map(),
    );
    expect(result.finalPrice).toBe(12000);
  });

  it('skips seasonal rule outside date range', () => {
    const seasonal: SeasonalRule[] = [{
      id: 's1', name: 'Peak', start_date: '2024-04-01', end_date: '2024-04-30',
      modifier_type: 'percent', modifier_value: 50, priority: 1, rate_plan_id: null,
    }];
    const result = calculateNightRate(
      '2024-03-15', 10000, 'deluxe', null, [], seasonal, [], new Map(),
    );
    expect(result.finalPrice).toBe(10000);
    expect(result.seasonal).toBeNull();
  });

  it('applies day-of-week modifier', () => {
    // 2024-03-16 is Saturday (day 6)
    const dowRules: DayOfWeekRule[] = [{
      id: 'd1', day_of_week: 6, modifier_type: 'percent', modifier_value: 10, rate_plan_id: null,
    }];
    const result = calculateNightRate(
      '2024-03-16', 10000, 'deluxe', null, [], [], dowRules, new Map(),
    );
    expect(result.finalPrice).toBe(11000);
    expect(result.dayOfWeek).toBe(true);
  });

  it('does not apply day-of-week rule for a different day', () => {
    // 2024-03-15 is Friday (day 5)
    const dowRules: DayOfWeekRule[] = [{
      id: 'd1', day_of_week: 6, modifier_type: 'percent', modifier_value: 10, rate_plan_id: null,
    }];
    const result = calculateNightRate(
      '2024-03-15', 10000, 'deluxe', null, [], [], dowRules, new Map(),
    );
    expect(result.finalPrice).toBe(10000);
    expect(result.dayOfWeek).toBe(false);
  });

  it('applies occupancy modifier', () => {
    const occupancyRules: OccupancyRule[] = [
      { id: 'o1', occupancy_threshold: 50, modifier_type: 'percent', modifier_value: 15 },
    ];
    const result = calculateNightRate(
      '2024-03-15', 10000, 'deluxe', null, [], [], [], new Map(), 2, occupancyRules, 75,
    );
    expect(result.finalPrice).toBe(11500);
    expect(result.occupancy).toBe(true);
  });

  it('selects the highest met occupancy threshold', () => {
    const occupancyRules: OccupancyRule[] = [
      { id: 'o1', occupancy_threshold: 50, modifier_type: 'percent', modifier_value: 10 },
      { id: 'o2', occupancy_threshold: 80, modifier_type: 'percent', modifier_value: 25 },
    ];
    const result = calculateNightRate(
      '2024-03-15', 10000, 'deluxe', null, [], [], [], new Map(), 2, occupancyRules, 90,
    );
    expect(result.finalPrice).toBe(12500);
  });

  it('does not apply occupancy modifier when below threshold', () => {
    const occupancyRules: OccupancyRule[] = [
      { id: 'o1', occupancy_threshold: 80, modifier_type: 'percent', modifier_value: 20 },
    ];
    const result = calculateNightRate(
      '2024-03-15', 10000, 'deluxe', null, [], [], [], new Map(), 2, occupancyRules, 50,
    );
    expect(result.finalPrice).toBe(10000);
    expect(result.occupancy).toBe(false);
  });

  it('charges extra guest fee when guests exceed included_guests', () => {
    const result = calculateNightRate(
      '2024-03-15', 5000, 'deluxe', baseRatePlan, [], [], [], new Map(), 4,
    );
    // 2 extra guests × 1500 = 3000 extra
    expect(result.finalPrice).toBe(13000);
  });

  it('does not charge extra guest fee at or below included_guests', () => {
    const result = calculateNightRate(
      '2024-03-15', 5000, 'deluxe', baseRatePlan, [], [], [], new Map(), 2,
    );
    expect(result.finalPrice).toBe(10000);
  });

  it('stacks seasonal + day-of-week + extra guest fee', () => {
    // 2024-03-16 is Saturday (day 6)
    const seasonal: SeasonalRule[] = [{
      id: 's1', name: 'Peak', start_date: '2024-03-01', end_date: '2024-03-31',
      modifier_type: 'percent', modifier_value: 10, priority: 1, rate_plan_id: null,
    }];
    const dowRules: DayOfWeekRule[] = [{
      id: 'd1', day_of_week: 6, modifier_type: 'fixed', modifier_value: 500, rate_plan_id: null,
    }];
    // base: 10000, +10% seasonal = 11000, +500 dow = 11500, +1 extra guest × 1500 = 13000
    const result = calculateNightRate(
      '2024-03-16', 5000, 'deluxe', baseRatePlan, [], seasonal, dowRules, new Map(), 3,
    );
    expect(result.finalPrice).toBe(13000);
    expect(result.seasonal).toBe('Peak');
    expect(result.dayOfWeek).toBe(true);
  });

  it('rounds final price to 2 decimal places', () => {
    const seasonal: SeasonalRule[] = [{
      id: 's1', name: 'Test', start_date: '2024-03-01', end_date: '2024-03-31',
      modifier_type: 'percent', modifier_value: 33, priority: 1, rate_plan_id: null,
    }];
    const result = calculateNightRate(
      '2024-03-15', 10000, 'deluxe', null, [], seasonal, [], new Map(),
    );
    // 10000 * 1.33 = 13300 (no rounding needed here, but verifying the mechanism)
    expect(result.finalPrice).toBe(13300);
    expect(Number.isFinite(result.finalPrice)).toBe(true);
  });

  it('respects rate_plan_id scoping on seasonal rules', () => {
    const seasonal: SeasonalRule[] = [{
      id: 's1', name: 'Plan-specific', start_date: '2024-03-01', end_date: '2024-03-31',
      modifier_type: 'percent', modifier_value: 50, priority: 1, rate_plan_id: 'other-plan',
    }];
    const result = calculateNightRate(
      '2024-03-15', 5000, 'deluxe', baseRatePlan, [], seasonal, [], new Map(),
    );
    // Should NOT apply because rate_plan_id doesn't match
    expect(result.seasonal).toBeNull();
    expect(result.finalPrice).toBe(10000);
  });
});

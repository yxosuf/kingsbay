import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatRateLimitError } from '../rateLimiting';
import type { RateLimitCheck } from '../rateLimiting';

describe('formatRateLimitError', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-03-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns singular "minute" for 1 minute remaining', () => {
    const check: RateLimitCheck = {
      allowed: false,
      remaining: 0,
      resetAt: new Date('2024-03-15T12:01:00Z'), // 1 min from now
    };
    expect(formatRateLimitError(check)).toBe(
      'Rate limit exceeded. Please try again in 1 minute.'
    );
  });

  it('returns plural "minutes" for >1 minute remaining', () => {
    const check: RateLimitCheck = {
      allowed: false,
      remaining: 0,
      resetAt: new Date('2024-03-15T12:15:00Z'), // 15 min from now
    };
    expect(formatRateLimitError(check)).toBe(
      'Rate limit exceeded. Please try again in 15 minutes.'
    );
  });

  it('rounds up partial minutes', () => {
    const check: RateLimitCheck = {
      allowed: false,
      remaining: 0,
      resetAt: new Date('2024-03-15T12:02:30Z'), // 2.5 min from now
    };
    expect(formatRateLimitError(check)).toBe(
      'Rate limit exceeded. Please try again in 3 minutes.'
    );
  });
});

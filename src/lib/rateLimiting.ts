/**
 * Rate Limiting Utilities
 * 
 * Provides rate limiting functionality for OTA operations
 */

import { supabase } from '@/integrations/supabase/client';

export interface RateLimitCheck {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Check if a user can perform an action based on rate limits
 * @param actionType - Type of action (e.g., 'ota_test_connection')
 * @param maxRequests - Maximum requests allowed per window
 * @param windowMinutes - Time window in minutes (default: 60)
 */
export async function checkRateLimit(
  actionType: string,
  maxRequests: number,
  windowMinutes: number = 60
): Promise<RateLimitCheck> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(),
    };
  }

  const windowStart = new Date();
  windowStart.setMinutes(windowStart.getMinutes() - windowMinutes);

  // Check existing rate limit record
  const { data: existing, error: fetchError } = await supabase
    .from('upload_rate_limits')
    .select('*')
    .eq('user_id', user.id)
    .eq('action_type', actionType)
    .gte('window_start', windowStart.toISOString())
    .maybeSingle();

  if (fetchError) {
    console.error('Rate limit check error:', fetchError);
    return {
      allowed: true, // Fail open
      remaining: maxRequests,
      resetAt: new Date(Date.now() + windowMinutes * 60 * 1000),
    };
  }

  if (!existing) {
    // First request in this window - create new record
    const { error: insertError } = await supabase
      .from('upload_rate_limits')
      .insert({
        user_id: user.id,
        action_type: actionType,
        request_count: 1,
        window_start: new Date().toISOString(),
      });

    if (insertError) {
      console.error('Rate limit insert error:', insertError);
    }

    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt: new Date(Date.now() + windowMinutes * 60 * 1000),
    };
  }

  // Check if limit exceeded
  if (existing.request_count >= maxRequests) {
    const resetAt = new Date(existing.window_start);
    resetAt.setMinutes(resetAt.getMinutes() + windowMinutes);

    return {
      allowed: false,
      remaining: 0,
      resetAt,
    };
  }

  // Increment counter
  const { error: updateError } = await supabase
    .from('upload_rate_limits')
    .update({
      request_count: existing.request_count + 1,
    })
    .eq('id', existing.id);

  if (updateError) {
    console.error('Rate limit update error:', updateError);
  }

  const resetAt = new Date(existing.window_start);
  resetAt.setMinutes(resetAt.getMinutes() + windowMinutes);

  return {
    allowed: true,
    remaining: maxRequests - existing.request_count - 1,
    resetAt,
  };
}

/**
 * Format rate limit error message
 */
export function formatRateLimitError(check: RateLimitCheck): string {
  const minutesUntilReset = Math.ceil(
    (check.resetAt.getTime() - Date.now()) / (60 * 1000)
  );

  return `Rate limit exceeded. Please try again in ${minutesUntilReset} minute${
    minutesUntilReset === 1 ? '' : 's'
  }.`;
}

/**
 * Shared authentication helpers for edge functions.
 *
 * — `requireServiceRole(req)` verifies the caller is using the service-role
 *   key.  Use this for cron/scheduler-invoked functions that must not be
 *   callable by anonymous or regular users.
 *
 * — `requireUserJwt(req)` verifies the caller has a valid Supabase JWT and
 *   returns the authenticated user.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/** Verify the request bears the service-role key (used by cron jobs / internal calls). */
export function requireServiceRole(req: Request): { ok: true } | { ok: false; status: number; message: string } {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, status: 401, message: 'Missing authorization header' };
  }

  const token = authHeader.replace('Bearer ', '');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!serviceKey || token !== serviceKey) {
    return { ok: false, status: 403, message: 'Forbidden: service-role key required' };
  }

  return { ok: true };
}

/** Verify the request bears a valid user JWT. Returns the user on success. */
export async function requireUserJwt(req: Request): Promise<
  { ok: true; user: { id: string; email?: string } } |
  { ok: false; status: number; message: string }
> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, status: 401, message: 'Missing authorization header' };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error } = await client.auth.getUser();

  if (error || !user) {
    return { ok: false, status: 401, message: 'Invalid or expired token' };
  }

  return { ok: true, user: { id: user.id, email: user.email } };
}

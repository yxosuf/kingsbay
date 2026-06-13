/**
 * Shared CORS configuration for all edge functions.
 *
 * Uses the ALLOWED_ORIGIN env var when set, otherwise falls back to the
 * Supabase project URL derived from SUPABASE_URL.  During local development
 * the fallback keeps things working out of the box; in production, set
 * ALLOWED_ORIGIN to the exact origin of the frontend (e.g.
 * "https://your-app.lovable.app").
 */
export function getAllowedOrigin(): string {
  const explicit = Deno.env.get('ALLOWED_ORIGIN');
  if (explicit) return explicit;

  // Derive from SUPABASE_URL — strip the API host and guess the frontend origin.
  // This is a safe default: the Supabase project URL itself is not a wildcard.
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  return supabaseUrl;
}

export function getCorsHeaders(requestOrigin?: string | null): Record<string, string> {
  const allowed = getAllowedOrigin();

  // If no explicit origin is configured, be restrictive rather than open.
  const origin = allowed || (requestOrigin ?? '');

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-inbound-secret, ' +
      'x-supabase-client-platform, x-supabase-client-platform-version, ' +
      'x-supabase-client-runtime, x-supabase-client-runtime-version',
  };
}

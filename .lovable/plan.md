

# Security Fixes Plan — Kings Bay PMS

## Two Security Findings

### Finding 1: Edge Functions Lack Authentication
Four edge functions use `verify_jwt = false` but don't validate callers in code.

### Finding 2: Guest PII Exposure Risk
Complex RLS policy on `guests` table may allow edge-case unauthorized access.

---

## Fixes

### 1. Secure `channel-sync` with JWT Authentication
- Called from frontend via `supabase.functions.invoke()` which auto-sends the user's JWT
- Add `getClaims()` validation at the top of the function
- Restrict to `admin` and `manager` roles only
- Then use service role client for the actual sync operations

### 2. Secure `ical-import` with JWT + Service-Role Bypass
- Called from two places: (a) frontend indirectly via channel-sync, and (b) directly by `channel-sync` using service role key
- Add authentication: accept either a valid staff JWT OR a service-role Authorization header
- This keeps the internal server-to-server call working while blocking unauthenticated external access

### 3. Secure `ical-export` with Token-Based Authentication
- This endpoint must remain "public" (no JWT) because OTA platforms (Booking.com, Airbnb) fetch it as a plain URL
- Add an `ical_export_token` column (UUID) to `channel_connections`
- Require `?token=<uuid>` query parameter on every export request
- Validate the token against the database before returning calendar data
- Auto-generate tokens when channels are created/enabled
- **DB migration**: Add `ical_export_token` column with default `gen_random_uuid()`

### 4. Harden `booking-email-inbound` Webhook
- Make `EMAIL_INBOUND_SECRET` **required** — reject all requests if the secret is not configured (currently it skips the check)
- Remove the `testMode` bypass that skips authentication entirely — test mode should still require the secret header
- Change the logic from `if (!isTestMode && expectedSecret && ...)` to `if (!expectedSecret) reject` then `if (inboundSecret !== expectedSecret) reject`

### 5. Simplify Guest RLS Policy
- The current SELECT policy has deeply nested EXISTS subqueries that are hard to audit
- Replace with a clearer security-definer function `can_view_guest(guest_row)` that encapsulates the same logic but is easier to verify
- Keeps the same access rules: admin/manager see all, front_desk sees only property-scoped guests

---

## Files Changed

| File | Change |
|------|--------|
| `supabase/functions/channel-sync/index.ts` | Add JWT auth + role check |
| `supabase/functions/ical-import/index.ts` | Add JWT/service-role auth check |
| `supabase/functions/ical-export/index.ts` | Add token-based auth |
| `supabase/functions/booking-email-inbound/index.ts` | Harden secret validation |
| DB migration | Add `ical_export_token` column, create `can_view_guest()` function, replace guest RLS policy |
| `src/pages/ChannelManager.tsx` | Auto-generate export URLs with token |
| `src/components/settings/ChannelsSettings.tsx` | Same token-aware export URL logic |


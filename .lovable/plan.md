

# OTA Integration Fix/Improvement Plan

## Scope
Audit and fix issues in the existing OTA integration implementation, focusing on code quality, security, and robustness.

---

## Issues Found

### 1. **Rate Limiting Implementation Bug**
**File**: `src/lib/rateLimiting.ts` (lines 37-42, 57-75)

**Problem**: 
- The logic checks `window_start >= windowStart.toISOString()` but should check if the existing window is **still valid** (not expired)
- A new window should be created if the old one has expired, not just if none exists
- Currently creates a new record every time `!existing` but doesn't handle window expiration

**Fix Required**:
- Check if `existing.window_start + windowMinutes` is **before** current time → window expired → create new record
- If window still valid and under limit → increment
- If window still valid and at limit → block

---

### 2. **Edge Function Missing Production API Integration**
**File**: `supabase/functions/ota-sync/index.ts` (lines 117-121)

**Problem**:
```typescript
// TODO: Actual OTA API call would go here based on integration.ota_name
// For now, simulate success
await new Promise((resolve) => setTimeout(resolve, 100));
success = true;
```

The edge function simulates success instead of calling the actual OTA provider classes (`BookingComIntegration`, `AirbnbIntegration`, etc.).

**Fix Required**:
- Import and instantiate the correct OTA provider based on `integration.ota_name`
- Call the actual `pushRates()` or `pushAvailability()` method
- Handle real success/failure responses

---

### 3. **Missing Property Access Check in Rate Limiting**
**File**: `src/lib/rateLimiting.ts`

**Problem**:
- Rate limits are tracked per `user_id` but don't validate that the user has access to the `property_id` they're testing
- A malicious user could test connections for properties they don't have access to (up to 5 times/hour)

**Fix Required**:
- Add property access validation before allowing rate-limited actions
- Use existing `can_access_property(property_id)` helper or similar

---

### 4. **Notification Failure Handling**
**Files**: 
- `src/lib/integrations/bookingCom.ts` (lines 246-274)
- Same pattern in `airbnb.ts`, `expedia.ts`, `agoda.ts`

**Problem**:
- `sendFailureNotification()` is called but errors are only logged to console
- If the notification edge function fails, there's no fallback or retry
- Silent failures mean admins might not know sync is failing

**Fix Required**:
- Log notification failures to `audit_logs` table for tracking
- Consider fallback mechanism (email alert, Slack webhook, etc.)

---

### 5. **Retry Count Not Incremented on Failure**
**File**: `src/lib/integrations/bookingCom.ts` (and all other OTA providers)

**Problem**:
- `updateSyncLog()` checks `retry_count >= 3` to send notifications
- But the actual `retry_count` is **never incremented** in the provider classes
- It stays at 0, so notifications never trigger after repeated failures

**Fix Required**:
- Add retry logic to provider classes or
- Increment `retry_count` in the database before checking threshold

---

### 6. **Missing Sandbox Mode in Edge Function**
**File**: `supabase/functions/ota-sync/index.ts`

**Problem**:
- The edge function doesn't pass `sandbox_mode` to the OTA provider constructors
- This means all API calls will use production URLs even if the integration is in sandbox mode

**Fix Required**:
- Pass `integration.sandbox_mode` to the OTA provider constructor

---

### 7. **Duplicate Database Queries**
**File**: `src/lib/integrations/bookingCom.ts` (lines 219-223, 226-234)

**Problem**:
```typescript
const { data: logData } = await supabase
  .from('ota_sync_logs')
  .select('retry_count')
  .eq('id', logId)
  .single();

const { error } = await supabase
  .from('ota_sync_logs')
  .update({ status, response_message, error_message })
  .eq('id', logId);
```

Two separate queries when one UPDATE with RETURNING would suffice.

**Fix Required**:
- Combine into single query using `.update().select()`
- Reduces latency and load

---

### 8. **Missing Type Safety in Edge Function**
**File**: `supabase/functions/ota-sync/index.ts`

**Problem**:
- `syncRequest` is typed but not validated at runtime
- Missing checks for required payload fields based on `action` type
- Could crash if malformed request is sent

**Fix Required**:
- Add runtime validation for `payload` structure
- Validate that `dates`/`rates` arrays match for `rate_push`
- Validate `date`/`available` exist for `availability_push`

---

### 9. **OtaSyncTab Auto-Seeding Race Condition**
**File**: `src/components/settings/OtaSyncTab.tsx` (lines 65-94)

**Problem**:
```typescript
useEffect(() => {
  const seedIntegrations = async () => {
    if (!integrationsLoading && integrations.length === 0 && ...) {
      hasSeeded.current.add(selectedProperty.id);
      const { error } = await supabase.from('ota_integrations').insert(seedData);
      // ...
    }
  };
  seedIntegrations();
}, [integrationsLoading, integrations.length, selectedProperty?.id, queryClient]);
```

**Problem**:
- If the component re-renders before the `insert` completes, `integrations.length === 0` is still true
- Could result in duplicate insert attempts (though unique constraint would prevent)
- Better to set the ref **after** successful insert, not before

**Fix Required**:
- Move `hasSeeded.current.add()` **after** successful insert
- Or add `hasSeeded.current.has()` check at the very start of the async function

---

### 10. **Missing Connection Test Timeout**
**File**: `src/lib/integrations/bookingCom.ts` (lines 41-77)

**Problem**:
- No timeout on the `fetch()` call
- If OTA API is down/slow, the request hangs indefinitely
- Could block the mutation and cause poor UX

**Fix Required**:
- Add `AbortController` with timeout (e.g., 10 seconds)
- Return timeout error if exceeded

---

## Implementation Steps

| # | File | Action |
|---|------|--------|
| 1 | `src/lib/rateLimiting.ts` | Fix window expiration logic |
| 2 | `supabase/functions/ota-sync/index.ts` | Integrate real OTA provider calls |
| 3 | `src/lib/rateLimiting.ts` | Add property access validation |
| 4 | `src/lib/integrations/*.ts` | Add audit log for notification failures |
| 5 | `src/lib/integrations/*.ts` | Implement retry count increment |
| 6 | `supabase/functions/ota-sync/index.ts` | Pass sandbox_mode to providers |
| 7 | `src/lib/integrations/bookingCom.ts` | Combine duplicate queries |
| 8 | `supabase/functions/ota-sync/index.ts` | Add payload validation |
| 9 | `src/components/settings/OtaSyncTab.tsx` | Fix race condition in auto-seed |
| 10 | `src/lib/integrations/*.ts` | Add fetch timeout (10s) |

---

## Verification Checklist

- ✅ Rate limit window expiration handled correctly
- ✅ Edge function calls real OTA provider classes
- ✅ Property access validated before rate-limited actions
- ✅ Notification failures logged to audit_logs
- ✅ Retry count incremented on each failure
- ✅ Sandbox mode respected in edge function
- ✅ Database queries optimized (no duplicate SELECTs)
- ✅ Edge function payload validated at runtime
- ✅ Auto-seeding race condition resolved
- ✅ Connection test has 10-second timeout


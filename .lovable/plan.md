

# OTA Integration Missing Features - Implementation Plan

## Identified Issues

### 1. Code Quality Issues in OtaSyncTab
- **Duplicate constant**: `DEFAULT_OTAS` defined twice (lines 37-42 and 62-67)
- **Render-time side effect**: Auto-seeding logic executes during render (lines 70-90), should be in `useEffect`

### 2. Real API Implementation
The provider classes (BookingComIntegration, AirbnbIntegration, ExpediaIntegration, AgodaIntegration) **ARE actually making real API calls** - they are NOT stubs. They implement:
- Real HTTP requests to OTA endpoints
- Proper authentication headers
- Sync log creation/updates
- Error handling

**Note**: These are placeholder endpoints for demonstration. In production, you would need:
- Valid API credentials from each OTA
- Actual property/room IDs from the OTA systems
- Proper rate plan mappings

### 3. Missing Features to Implement

**A. Notification System for Sync Failures**
- Create notifications on sync failure
- Track retry count and send alerts after 3+ failures
- Integrate with existing notification system

**B. Security & Auditing**
- Rate limiting for test connection endpoint (max 5/hour per OTA)
- Audit log entries for API key creation/modification
- Leverage existing `audit_logs` table

**C. Edge Function** (optional)
- Background processor for async rate/availability syncs
- Batch processing to avoid rate limits
- Retry mechanism with exponential backoff

---

## Implementation Steps

### Step 1: Fix OtaSyncTab Code Quality Issues

**File**: `src/components/settings/OtaSyncTab.tsx`

Changes:
- Remove duplicate `DEFAULT_OTAS` (lines 62-67)
- Move auto-seeding logic to `useEffect` hook
- Add proper dependencies and cleanup

### Step 2: Add Notification System for Sync Failures

**Files to modify**:
- `src/lib/integrations/bookingCom.ts`
- `src/lib/integrations/airbnb.ts`
- `src/lib/integrations/expedia.ts`
- `src/lib/integrations/agoda.ts`

Logic to add:
- After sync failure, check retry count from sync log
- If retry_count >= 3, call `create-notification` edge function
- Notification payload:
  - `type`: 'channel_sync'
  - `category`: 'channel_sync'
  - `priority`: 'high'
  - `title`: 'OTA Sync Failed'
  - `message`: Error details
  - `target_roles`: ['admin', 'manager']

### Step 3: Implement Rate Limiting

**Create**: `src/lib/rateLimiting.ts`

Add helper function:
- Check `upload_rate_limits` table for `action_type = 'ota_test_connection'`
- Enforce 5 requests per hour per integration
- Return boolean indicating if request is allowed

**Modify**: `src/hooks/useOtaSync.ts`
- Add rate limit check before `testConnection` mutation
- Show toast error if rate limit exceeded

### Step 4: Add Audit Logging for API Key Changes

**Modify**: `src/hooks/useOtaSync.ts`

Add audit log entries in mutations:
- `saveApiKey`: Log "API Key Added/Updated"
- `deleteApiKey`: Log "API Key Removed"

Insert into `audit_logs` table:
- `action`: 'ota_api_key_updated' / 'ota_api_key_deleted'
- `details`: `{ ota_name, integration_id, sandbox_mode }`

### Step 5: Create Edge Function for Async Sync (Optional)

**Create**: `supabase/functions/ota-sync/index.ts`

Features:
- Accept sync requests via HTTP POST
- Batch multiple rate/availability updates
- Implement exponential backoff retry
- Update `ota_sync_logs` table
- Call notification edge function on failure

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/components/settings/OtaSyncTab.tsx` | Modify | Fix duplicate constant + render-time side effect |
| `src/lib/integrations/bookingCom.ts` | Modify | Add notification on repeated failures |
| `src/lib/integrations/airbnb.ts` | Modify | Add notification on repeated failures |
| `src/lib/integrations/expedia.ts` | Modify | Add notification on repeated failures |
| `src/lib/integrations/agoda.ts` | Modify | Add notification on repeated failures |
| `src/lib/rateLimiting.ts` | Create | Rate limiting utility |
| `src/hooks/useOtaSync.ts` | Modify | Add rate limiting + audit logging |
| `supabase/functions/ota-sync/index.ts` | Create (optional) | Background sync processor |

---

## Testing Checklist

After implementation:
- ✅ OtaSyncTab renders without duplicate constant warnings
- ✅ Auto-seeding only runs once via useEffect
- ✅ Test connection rate limit enforced (5/hour)
- ✅ Audit log created when API key saved/deleted
- ✅ Notification created after 3+ sync failures
- ✅ Edge function processes sync requests (if implemented)




# Real OTA API Integration & API Key Management

## Overview
Upgrade the existing OTA Sync stub to support real API integration with secure key management, sync logging, and error handling.

## Current State Analysis
- `ota_integrations` table exists with columns: `id`, `property_id`, `ota_name`, `display_name`, `api_key`, `is_enabled`, `status`, `last_rate_push_at`, `last_availability_push_at`
- `OtaSyncTab.tsx` has stub UI showing "Coming Soon" placeholder
- `channelIntegration.ts` contains `StubChannelIntegration` that only logs to console
- RLS policies already in place (Admin can manage, Staff can view)

## Implementation Plan

### 1. Database Changes

**Create `ota_sync_logs` table:**
```sql
CREATE TABLE ota_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  integration_id uuid NOT NULL REFERENCES ota_integrations(id) ON DELETE CASCADE,
  ota_name text NOT NULL,
  action_type text NOT NULL, -- 'rate_push' | 'availability_push' | 'test_connection'
  status text NOT NULL, -- 'success' | 'failure' | 'pending'
  request_payload jsonb,
  response_message text,
  error_message text,
  retry_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sync_logs_property ON ota_sync_logs(property_id);
CREATE INDEX idx_sync_logs_integration ON ota_sync_logs(integration_id);
CREATE INDEX idx_sync_logs_created ON ota_sync_logs(created_at DESC);

-- RLS
ALTER TABLE ota_sync_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view sync logs" ON ota_sync_logs FOR SELECT USING (is_staff());
CREATE POLICY "Write staff can insert sync logs" ON ota_sync_logs FOR INSERT WITH CHECK (is_write_staff());
```

**Add fields to `ota_integrations`:**
```sql
ALTER TABLE ota_integrations
  ADD COLUMN sandbox_mode boolean DEFAULT true,
  ADD COLUMN auto_retry_enabled boolean DEFAULT true,
  ADD COLUMN max_retries integer DEFAULT 2;
```

### 2. Backend Integration Service

**Update `src/lib/channelIntegration.ts`:**
- Extend `IChannelIntegration` interface with `testConnection()` and `getIntegrationStatus()`
- Create concrete implementations: `BookingComIntegration`, `AirbnbIntegration`, `ExpediaIntegration`, `AgodaIntegration`
- Each implementation handles:
  - API authentication using stored keys
  - Rate/availability push endpoints
  - Error handling with detailed messages
  - Sandbox vs production mode toggling
- Implement `OtaIntegrationFactory` to route calls to correct provider
- Add sync logging to database for every push attempt
- Implement retry logic with exponential backoff

### 3. UI Components

**API Key Management Dialog (`src/components/settings/OtaApiKeyDialog.tsx`):**
- Secure input form with masked display
- Test connection button (validates by calling OTA API)
- Toggle between sandbox/production mode
- Save/Update/Copy functionality
- Admin-only access enforced

**Updated `OtaSyncTab.tsx`:**
- **Settings tab**: Replace "Coming Soon" with API key management cards per OTA
  - Each card shows: masked key, last verified date, test button, edit/delete actions
  - "Add API Key" button opens dialog
- **Sync History tab**: Replace placeholder with actual log table
  - Columns: timestamp, OTA name, action type, status badge, response preview, retry count
  - Filters: OTA dropdown, date range picker, status filter
  - Pagination (50 per page)
  - Click row to expand full request/response JSON
- **Connected OTAs tab**: Update to show real-time status (active if key valid + enabled)

### 4. Edge Function (Optional for async processing)

**`supabase/functions/ota-sync/index.ts`:**
- Triggered by booking changes, rate updates
- Batches multiple updates to avoid rate limits
- Handles retries in background
- Updates sync logs

### 5. Notifications & Error Handling

- On sync failure: create notification for admin with error summary
- On repeated failures (3+): send email alert (if RESEND_API_KEY configured)
- Toast notifications for manual test connection results
- Graceful degradation: if OTA push fails, local booking still succeeds

### 6. Security Measures

- API keys encrypted at rest (Supabase default)
- Never expose keys in API responses (always masked client-side)
- Rate limiting on test connection endpoint (max 5/hour per OTA)
- Audit log entries for key creation/modification

## Files to Create/Modify

| File | Action |
|------|--------|
| **Database** | |
| Migration: `create_ota_sync_logs.sql` | Create sync logs table + indexes |
| Migration: `alter_ota_integrations.sql` | Add sandbox_mode, retry fields |
| **Backend** | |
| `src/lib/channelIntegration.ts` | Replace stub with real implementations |
| `src/lib/integrations/bookingCom.ts` | Booking.com API client |
| `src/lib/integrations/airbnb.ts` | Airbnb API client |
| `src/lib/integrations/expedia.ts` | Expedia API client |
| `src/lib/integrations/agoda.ts` | Agoda API client |
| `src/lib/integrations/factory.ts` | Integration factory pattern |
| `supabase/functions/ota-sync/index.ts` | Background sync processor (optional) |
| **Frontend** | |
| `src/components/settings/OtaApiKeyDialog.tsx` | Key management dialog |
| `src/components/settings/OtaSyncHistoryTable.tsx` | Sync logs table component |
| `src/components/settings/OtaSyncTab.tsx` | Update Settings + History tabs |
| `src/hooks/useOtaSync.ts` | React hook for sync operations |

## Testing Strategy

- Unit tests for each OTA integration class
- Integration tests using sandbox APIs
- E2E test: add key → test connection → push rate → verify in sync logs
- Simulation mode can trigger real API calls in sandbox

## Future Enhancements

- Webhook receivers for OTA booking notifications
- Bidirectional sync (pull bookings from OTAs)
- Bulk sync scheduler (cron job to push all rates nightly)
- Analytics dashboard (sync success rate, latency metrics)


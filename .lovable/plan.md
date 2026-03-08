

# System Health Enhancement Plan

## Current State

The System Health tab has 8 checks: Property Isolation, Overlap Prevention, Role System, FX Rate, Scheduled Jobs, Database Connection, Ledger Balance, Transaction Coverage.

## New Health Check Engines to Add

Group the checks into categories and add these new engines:

### 1. Rate Engine Health (new)
- **Rate Plans Active** — At least 1 active rate plan exists for selected property
- **Seasonal Rules Valid** — No expired/overlapping seasonal rules with conflicting priorities
- **Rate Overrides Consistency** — No overrides for past dates still marked as closed (stale closures)
- **Discount Codes Active** — Check for expired but still `is_active=true` discount codes
- **Occupancy Rules** — Verify threshold ordering (no duplicates, thresholds ascending)

### 2. Booking Flow Health (new)
- **Orphan Bookings** — Bookings with missing guest_id or room_id references
- **Stale Pending** — Pending bookings older than 48h (should be reviewed)
- **Price Breakdown Coverage** — % of bookings with `price_breakdown` stored vs null (legacy)
- **Discount Usage Integrity** — discount_code_usages records match bookings that actually have discount_code_id

### 3. Channel Sync Health (new)
- **Channel Connections** — Count of active channels per property
- **Last Sync** — Most recent sync_log per channel, warn if >24h stale
- **Sync Errors** — Count of failed syncs in last 7 days

### 4. Housekeeping Health (new)
- **Stuck Cleaning** — Rooms in `cleaning` status past their `cleaning_until` time
- **Dirty Room Backlog** — Count of dirty rooms not yet assigned

### 5. Guest Data Health (new)
- **Guest Completeness** — % of guests with email or phone filled
- **Passport Compliance** — Foreign guests (`guest_type = 'foreign'`) missing passport data
- **Orphan Guests** — Guests with zero bookings (no matching booking_id)

### 6. Storage & Data Integrity (new)
- **Passport Storage** — Count of passport_photos vs guests with passport data
- **Invoice Numbering** — Check for duplicate invoice numbers

## UI Changes

Group all checks into collapsible sections with category headers:

```text
┌─ Core Infrastructure ────────────────────┐
│  Database Connection | Role System | FX   │
├─ Booking Engine ─────────────────────────┤
│  Overlap | Orphans | Stale Pending | ...  │
├─ Rate Engine ────────────────────────────┤
│  Rate Plans | Seasons | Overrides | ...   │
├─ Channel Sync ───────────────────────────┤
│  Connections | Last Sync | Errors         │
├─ Housekeeping ───────────────────────────┤
│  Stuck Cleaning | Dirty Backlog           │
├─ Guest & Compliance ────────────────────┤
│  Completeness | Passport | Orphans        │
├─ Financial Integrity ────────────────────┤
│  Ledger Balance | Txn Coverage | Invoices │
└──────────────────────────────────────────┘
```

Each section shows its own pass/warn/fail mini-count badge. Summary cards at top aggregate all.

## Files Modified

| File | Change |
|------|--------|
| `src/components/settings/SystemHealthSettings.tsx` | Full rewrite — grouped categories, ~20 new checks |

No database changes needed — all checks are read-only queries against existing tables.


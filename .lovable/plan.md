# Plan: Comprehensive State Assessment and Fixes

## Current State Summary

After reviewing the codebase, here is what is already working and what needs attention:

### Already Working

- **Date logic**: `dateUtils.ts` correctly implements `[check_in, check_out)` with string comparison
- **Guests redirect**: `/guests` properly redirects to `/settings?tab=guests`
- **Settings vertical nav**: Working with section grouping and tab aliases
- **Hotel Settings**: Check-in/check-out time configuration
- **GuestsSettings**: Full guest list with search, property filtering, admin delete
- **Hold-timeout-release edge function**: Deployed
- **Viewer role enforcement**: `canWrite` flag used across booking pages

### Issues to Fix

**1. Dashboard `today` date uses timezone-unsafe method (line 93 of Index.tsx)**

```js
const today = new Date().toISOString().split('T')[0]; // UTC-based, can shift dates
```

Should use `toDateString(new Date())` from `dateUtils.ts`.

**2. Dashboard exchange rate is hardcoded/stale**  
`fetchExchangeRate` likely uses a cached or hardcoded value instead of fetching from DB. Need to verify and fix.

**3. Guest delete is hard delete, not soft delete**  
`GuestsSettings.tsx` line 96 does `.delete()` instead of updating `deleted_at`. Per project rules, it should be soft delete to preserve booking history.

**4.** `no_show` **status missing from availability exclusion in some queries**
The availability calendar fetches only `['confirmed', 'checked_in', 'pending', 'needs_review']` which is correct (no_show excluded). But the `check_booking_overlap` DB function may still not exclude `no_show`. The plan from `.lovable/plan.md` was to fix this but may not have been applied.

**5. Channel Manager page exists as standalone route** `/channels` **but also embedded in Settings**
There's both `src/pages/ChannelManager.tsx` at `/channels` route AND `ChannelsSettings` embedded in Settings. The sidebar doesn't link to `/channels`. This is fine but the standalone page could be removed or kept as-is.

## Implementation Plan

### Task 1: Fix guest soft delete

- In `src/components/settings/GuestsSettings.tsx`, change `handleDeleteGuest` from `.delete()` to `.update({ deleted_at: new Date().toISOString() })`
- Add `deleted_at` filter to `fetchGuests` query: `.is('deleted_at', null)`
- Update the confirmation dialog text to say "archive" instead of "permanently delete"

### Task 2: Fix Dashboard exchange rate to fetch from DB

- In `src/pages/Index.tsx`, update `fetchExchangeRate` to query `property_inventory_settings` or a dedicated FX table for the latest rate instead of using a hardcoded value

### Task 3: Fix Dashboard available rooms calculation

- Instead of counting `rooms.status = 'available'`, count total rooms minus rooms with active bookings for today using the same `[check_in, check_out)` logic

### Task 4: Verify DB overlap function includes checked_out and no_show exclusions

- The `.lovable/plan.md` documents this fix but it may not have been applied yet. Create a migration if needed to ensure `check_booking_overlap` excludes `checked_out` and `no_show`.

### What This Does NOT Change

- No database schema changes (except possibly the overlap function fix)
- No route changes
- No RLS policy changes
- No edge function changes

&nbsp;

# VILLA PMS — FULL MASTER PLAN (ALL FEATURES MERGED, NOTHING LOST)

This is the **complete** merged plan from our whole chat: booking lifecycle + rooms/availability fixes + guests + security + payments/accounting + notifications + channel safety + settings refactor + system health monitor.

**Non‑negotiable:** keep **ALL flows consistent** across **Bookings, Rooms, Availability Calendar, Dashboard, Guests, Reports, Settings, Channel Manager** with **strict multi‑property isolation**.

---

## 0) Global Rules (Must Follow Everywhere)

1. **Multi‑property isolation**

- Every query must be scoped by `property_id` (unless admin explicitly selects “All properties”).
- Never allow cross‑property joins that leak data.

2. **Date rule (hotel stay nights)**

- A stay blocks nights in **[check_in_date, check_out_date)**.
- The **check_out_date is NOT an occupied night**.

3. **Blocking statuses**

- Availability is blocked only by bookings with status: `pending`, `confirmed`, `checked_in`, and `needs_review` **only while hold is active**.
- NOT blocked by: `cancelled`, `checked_out`, `no_show`, expired holds.

4. **No breaking changes**

- Migrations must be safe.
- Migrate existing data with sensible defaults.

5. **Roles + RLS must match UI**

- UI restrictions must be enforced by backend policies too.

---

## 1) Booking Lifecycle + Clean Bookings Tab (Clutter Fix)

### 1.1 Booking statuses

Allowed:

- `pending` (optional)
- `confirmed`
- `checked_in`
- `checked_out`
- `cancelled`
- `no_show`
- `needs_review`
- `needs_review_expired` (recommended) OR reuse cancelled with reason “hold expired”

### 1.2 Booking columns (ensure exist)

- `status` TEXT/ENUM default `confirmed`
- `checked_in_at`, `checked_out_at`, `cancelled_at`, `no_show_at` timestamptz
- `cancel_reason` text
- `updated_at` timestamptz default now()
- `hold_expires_at` timestamptz (for needs_review holds)

### 1.3 Bookings page views (tabs)

- **Today:** arrivals today + departures today (only active statuses)
- **Upcoming:** future `confirmed`
- **In‑house:** `checked_in`
- **Past:** `checked_out`
- **Cancelled:** `cancelled` + `no_show`
- **Needs Review:** `needs_review` + `needs_review_expired`
- **All:** admin only

### 1.4 Quick actions (row/card)

- Check‑in → set `status=checked_in`, set `checked_in_at=now()`
- Check‑out → set `status=checked_out`, set `checked_out_at=now()`, trigger housekeeping flow
- Cancel → set `status=cancelled`, set `cancelled_at=now()`, require reason
- No‑show → set `status=no_show`, set `no_show_at=now()`

### 1.5 Booking detail page

- Status badge
- Timeline (created → check‑in → check‑out/cancel/no‑show)
- Admin override status (requires audit note)

---

## 2) Checkout Rule (11:00 AM) + Adjustable Per Property

### 2.1 Property settings

Add to `property_inventory_settings` (or dedicated settings table):

- `checkout_time` time default `11:00`
- `checkin_time` time default `14:00`

### 2.2 UI logic

- On checkout date **before** checkout_time: show **Due Out Today**
- After staff processes checkout: booking becomes `checked_out`

---

## 3) Rooms Operational Layer + Housekeeping Board (Fix “Room not available after checkout”)

### 3.1 Separate concepts

- **Booking status** controls availability.
- **Housekeeping status** controls readiness.

### 3.2 Rooms fields

- `housekeeping_status` enum: `dirty | cleaning | clean | inspected` (default `clean`)
- `last_checkout_at` timestamptz
- Optional: `cleaning_started_at`, `cleaning_completed_at`, `inspected_by`, `assigned_to`

### 3.3 Rooms page derived states

Use bookings where status in (`pending`,`confirmed`,`checked_in`,`needs_review` with active hold) and apply [check_in, check_out) logic:

- Occupied: `checked_in` and today < check_out
- Due Out Today: `checked_in` and today == check_out (consider checkout_time)
- Arriving Today: `confirmed` and today == check_in
- Held: `needs_review` with active hold
- Dirty/Cleaning/Clean/Inspected based on housekeeping board
- Available: no active booking AND housekeeping is `clean` or `inspected`

### 3.4 Checkout flow

When checkout:

- booking → `checked_out`, set `checked_out_at`
- room housekeeping → `dirty`, set `last_checkout_at`
- availability auto releases because `checked_out` does not block

### 3.5 Cleaning timer (NEW request)

**Requested logic:** after checkout, room shows **Cleaning or Maintenance for 1.5 hours**, then auto sets to Available.

Implement:

- Add `auto_cleaning_minutes` per property (default 90)
- Add `cleaning_until` timestamptz on rooms

On checkout:

- set `housekeeping_status='cleaning'`
- set `cleaning_started_at=now()`
- set `cleaning_until = now() + interval '90 minutes'` (or property setting)

Auto job (every 10–30 min):

- if `housekeeping_status='cleaning'` AND `cleaning_until < now()` then set `housekeeping_status='clean'` (or `inspected` if you want)

Make sure Rooms tab + Availability calendar reflect changes.

---

## 4) Availability Calendar “1 Night = 2 Days” Bug (CRITICAL)

### 4.1 Standardize date handling

- DB check_in/check_out are **DATE type** (you confirmed).
- Treat them as **date strings** `YYYY-MM-DD` in UI.

### 4.2 Cell block logic (must be identical everywhere)

For each cell `cellDateStr`:

- Block if: `cellDateStr >= check_in AND cellDateStr < check_out`
- Never use `<= check_out`.

### 4.3 Timezone drift prevention

- When converting JS Dates to strings, normalize in **Asia/Colombo**.
- Prefer string compare to avoid `new Date('YYYY-MM-DD')` shifting.

### 4.4 Blocking statuses

- Block: `pending, confirmed, checked_in`
- Block: `needs_review` ONLY if hold still active
- Don’t block: `cancelled, checked_out, no_show, needs_review_expired`

---

## 5) Hybrid Hold System for needs_review (MISSING FEATURE)

Goal: `needs_review` bookings temporarily block availability then auto‑release.

### 5.1 DB

- `hold_timeout_hours` in `property_inventory_settings` default 4
- `hold_expires_at` in bookings

When booking becomes `needs_review`:

- set `hold_expires_at = now() + (hold_timeout_hours hours)`

### 5.2 Scheduled auto‑release

Implement ONE:

- **pg_cron** job (preferred) OR scheduled edge function

Every 15 minutes:

- find bookings where `status='needs_review'` AND `hold_expires_at < now()`
- set status to `needs_review_expired` OR `cancelled` with reason “Hold expired – auto released”
- ensure availability is released
- log to `hold_release_logs` OR `email_ingest_logs` with provider `hold-timeout-release`

### 5.3 UI

- Needs Review list shows countdown
- Expired shows badge “Expired – requires manual review”

---

## 6) USD/LKR Dual Display + FX Update Bug

### 6.1 DB

Keep base amounts in LKR.  
Add:

- `fx_usd_lkr_rate` numeric
- `fx_updated_at` timestamptz

### 6.2 UI

- Primary: LKR amount
- Secondary under it: `~ USD` computed using latest rate

### 6.3 Fix “rate not updating”

- Dashboard must fetch latest rate from DB (no stale caching)
- Add admin input in Settings to update FX

---

## 7) Guests Management (Local/International) + Move Guests to Settings

### 7.1 Navigation change

- Remove Guests from main sidebar
- Add Settings → Guests

### 7.2 Guest fields

Add to guests:

- `guest_type` enum: local | international
- `country`
- `passport_number` (encrypted later)
- `nic_number` (encrypted later)
- `address` (encrypted later)
- `is_vip`, `is_blacklisted`, `blacklist_reason`
- `total_stays`, `total_spent`
- `passport_photo_path`, `passport_photo_uploaded_at`

### 7.3 Guest type logic

- Country = Sri Lanka → local
- Else → international
- Allow manual override

### 7.4 Required fields

- international → passport required
- local → NIC required

### 7.5 Guest profile page must show

- Full details
- Booking history timeline
- Services purchased + totals

---

## 8) Passport Photo Upload + Secure Storage

- Private bucket: `guest-documents`
- Path: `{property_id}/{guest_id}/passport.{ext}`
- Use signed URLs (5 minutes)
- Staff/admin same property only
- Export reports only show yes/no (not the image)

Optional:

- auto delete passport photo 30 days after checkout

---

## 9) Guest Retention (Guests not disappearing)

Goal: Guests list shouldn’t be infinite.

### 9.1 DB

Add:

- `archived_at` timestamptz
- `deleted_at` timestamptz (soft delete)

### 9.2 Rules

- Auto‑archive 1 month after last checkout
- Auto soft‑delete 13 months after last checkout
- Keep bookings/reports intact

### 9.3 UI

- Filters: Active / Archived / Deleted
- Admin can restore (clear archived_at/deleted_at)

### 9.4 Scheduled job

Daily job per property using pg_cron or edge function.

---

## 10) Roles + Viewer Role (Read‑Only)

Add role: `viewer`

Viewer CAN:

- see dashboard
- see bookings
- see availability
- see guests
- see reports

Viewer CANNOT:

- create/edit bookings
- check-in/out
- cancel/no-show
- edit guests
- change settings
- delete anything

Must be enforced by:

- Backend RLS policies
- UI button hiding/disable

---

## 11) Danger Zone: Clear Property Data (Testing Phase)

Admin‑only Settings → Danger Zone:

Button: **Clear Property Data**

Flow:

- double confirm
- ask admin password (re-auth) to confirm
- run RPC `clear_property_data(p_property_id)`
- clears: guests, bookings, transactions, services logs, availability history, notifications, reports/revenue records for selected property
- keeps: property record + rooms + settings + users
- logs action to `audit_logs`

**Multi-property safe:** affects selected property only.

---

## 12) New Booking Form Improvements (Nationality + Phone Code)

Add fields:

- nationality/country selector
- auto dial code
- manual dial code edit

Store:

- `phone_country_code`
- `phone_number`
- `phone_e164` computed

Behavior:

- Sri Lanka → +94
- India → +91
- Support all countries

---

## 13) Front Desk Mode (Reception Speed)

Create **Front Desk Mode** page:

- Today Arrivals
- In-House
- Today Departures
- Pending Payments

Booking card quick actions:

- Check-in
- Check-out
- Add Service
- Take Payment
- Extend Stay
- Cancel / No-show

Performance:

- eager load guest + room + balance summary

Auto guest detection:

- link guest if same phone/passport

---

## 14) Overbooking / Channel Sync Safety

- Conflict detection before confirming booking
- Room booking lock (30 seconds) during creation
- Channel manager dashboard: last sync, errors, conflicts
- Optional inventory safety buffer

---

## 15) Money / Payments System + Transaction Ledger

Create table `booking_transactions`:

- booking_id, property_id, amount, currency, transaction_type, payment_method, created_at

Rules:

- show total
- payments received
- outstanding
- allow partial payments + refunds
- track OTA commission

---

## 16) Operations Notifications

Table `notifications`:

- property_id, title, message, level, created_at, read_at

Bell in header + dashboard alerts.

---

## 17) Data Quality

- duplicate detection (phone/passport)
- merge option
- required fields (passport/NIC based on guest_type)
- bookings archive view (example: >90 days)
- search by name/phone/passport/NIC/booking id/room

---

## 18) Settings Page Refactor (UI/Structure Only)

Goal: fix blank sections and improve Settings UX without breaking existing logic.

Must:

- Ensure all tabs render their components: property, guests, services, channels, reports, security
- Keep old URLs: `?tab=users`, `?tab=hotel`, `?tab=danger`

UX:

- collapse main app sidebar on /settings, restore on exit
- sticky settings nav + sticky settings header
- sticky segmented sub-tabs inside Channel Manager with badge counts

---

## 19) System Health Monitor (Admin Only) + Accounting Layer

### 19.1 Location

Settings tab:

- `/settings?tab=system-health`

### 19.2 Backend

RPC:

- `system_health_check(p_property_id uuid)`

Returns JSON with grouped checks and details.

### 19.3 Checks

Core Data Integrity:

- Property Isolation
- Overlap Prevention

Financial Engine:

- Commission Accuracy
- Tax Engine
- Card Surcharge
- FX Currency Sync freshness

Operational Systems:

- Cleaning timer job
- Hold auto release

Sync & Automation:

- iCal Idempotency
- Retention job status

### 19.4 Accounting Layer (Double-entry minimal)

Tables:

- ledger_accounts
- ledger_entries
- ledger_lines

Rule:

- every entry balanced: SUM(debit)=SUM(credit)

Auto posting rules:

- Booking confirmed → AR / Revenue
- Tax → Tax payable
- Commission → Commission expense / OTA payable
- Payment → Cash/Bank/Card / AR
- Refund → reverse

Accounting diagnostics:

- ledger balance
- booking revenue reconciliation
- tax payable reconciliation
- commission reconciliation
- payments vs AR
- orphan accounting rows

---

## 20) Remaining Known Bug/Gap Checklist

Must verify after implementation:

1. Booking Mar 3 → Mar 4 blocks ONLY Mar 3 (calendar + dashboard)
2. checked_out/cancelled/no_show never block availability
3. needs_review blocks only until hold expiry
4. checkout triggers dirty/cleaning state correctly and releases availability
5. rooms become available after cleaning timer completion + no active booking
6. Guests in Settings tab render correctly and details show services purchased
7. Viewer role cannot do any writes (UI + RLS)
8. FX rate changes immediately reflect on dashboard
9. Danger Zone clears only selected property
10. System Health monitor returns PASS/FAIL with details

---

# DELIVERABLES

1. Safe DB migrations + data migration scripts
2. Edge functions / RPC for holds + retention + cleaning timer + system health
3. Updated UI flows across Bookings/Rooms/Calendar/Dashboard/Settings/Guests
4. RLS policy updates for viewer role + admin-only features
5. Test checklist in PR summary

---

# FINAL DECISION (Hold Behavior)

**Choose Option A (Recommended):**

- `needs_review` blocks availability **temporarily** until `hold_expires_at`.
- After expiry, auto mark `needs_review_expired` (or cancel w/ reason) and release availability.

Reason: prevents overbooking while still preventing permanent locks.
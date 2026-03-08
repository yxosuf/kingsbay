Villa PMS — Full Master Plan Implementation 

This plan merges Lovable’s current plan with **all missing requirements** from our past chats.  
**Rule:** No flow breaks. Every change must stay consistent across **Bookings, Rooms, Availability Calendar, Dashboard, Guests (in Settings), Reports**, and **Multi-property**.

---

## Current State Assessment

### Already Implemented (Confirmed)

- Booking lifecycle UI: tabs + quick actions + timestamps + timeline + admin override
- Guests moved under **Settings** + `/guests` redirect exists
- Viewer role exists in UI (`canWrite`) + buttons hidden
- Danger Zone “Clear Property Data” exists with password confirmation (per property)
- Hold-timeout-release edge function exists (deployed) but must be verified end-to-end
- Booking form has country/nationality UI partially
- Settings sidebar + tab aliases exist
- Checkout/checkin time settings exist (11:00 default)
- Housekeeping_status exists (dirty/cleaning/clean/inspected)
- Some date logic uses `[check_in, check_out)` but **your calendar still shows wrong blocking**, so we treat it as **NOT fully fixed**

### Critical Security Issue (Must Fix)

**Viewer role RLS is broken**: if DB policies allow write using `is_staff()` and viewer is considered staff, viewer can write via API. Must be fixed in Phase 1.

---

# Global Rules (Non-Negotiable)

1. **Multi-property isolation everywhere** (selectedProperty scope unless admin chooses all).
2. **All date logic uses** `[check_in, check_out)` (checkout day is NOT occupied).
3. **Calendar & occupancy comparisons must use date-only strings** (`YYYY-MM-DD`) and property timezone (**Asia/Colombo**).
4. **Do not rely on room.status='occupied'** for occupancy; derive from bookings + housekeeping.
5. **needs_review hold blocks temporarily only** (hybrid hold system) and must auto-release.
6. **Guests must live in Settings**, guest details must show **services purchased** + totals.
7. **Testing-phase master clear** must be safe, per-property, admin-password protected, and logs actions.

---

# Phase 1 — Critical Fixes (Do these first)

## 1) Fix Viewer Role RLS (Security — CRITICAL)

**Goal:** Viewer can read only; can’t create/edit/delete via API.

### DB Migration

- Create `is_write_staff()` returns true only for `admin`, `manager`, `front_desk` (NOT viewer)
- Update RLS policies:
  - INSERT/UPDATE/DELETE must use `is_write_staff()`
  - SELECT remains `is_staff()` (viewer can read)

Apply to:  
`bookings`, `guests`, `guest_services`, `invoices`, `payments`, `booking_transactions` (if exists), `room_availability`, `audit_logs`, `email_ingest_logs`, `notifications`, `ledger_*` (if added)

---

## 2) Fix Availability Calendar Bug (Your screenshot issue) — CRITICAL

**Problem:** “1 night blocks wrong days / blocks checkout day / shows only one wrong day”

### Hard Rule

A booking blocks only if:  
`cellDateStr >= check_in_date AND cellDateStr < check_out_date`

### Implementation Requirements

- Treat booking check_in/check_out as **DATE type** (you confirmed DB is DATE) ✅
- In frontend:
  - Always compare using **date strings** `YYYY-MM-DD`, not raw JS Date comparisons
  - Use helpers:
    - `toDateString(date, tz='Asia/Colombo')`
    - `isDateInBookingRange(dateStr, checkInStr, checkOutStr)`
- Apply fixes consistently in:
  - `AvailabilityCalendar.tsx`
  - `DashboardAvailabilityCalendar.tsx`
  - any occupancy tiles / “available rooms today” logic
  - any “overlap check” UI logic (frontend checks)

### Status Blocking Rules

Block availability only for:

- `confirmed`, `checked_in`, `pending`
- `needs_review` only if hold is active (see Phase 1 #3)

Never block for:

- `cancelled`, `checked_out`, `no_show`
- `needs_review` after hold expired

---

## 3) Complete Hybrid Hold System End-to-End (Missing / not reliable)

**Goal:** `needs_review` blocks temporarily, then auto-releases.

### DB Rules

Ensure bookings has:

- `hold_expires_at timestamptz`  
Property settings has:
- `hold_timeout_hours int default 4`

When status becomes `needs_review`:

- set `hold_expires_at = now() + interval (hold_timeout_hours)`

### Auto-release Job (Required)

Implement scheduled job:

- pg_cron recommended (or scheduled edge function)
- runs every 10–15 minutes

Logic:

- Find bookings where:
  - status = `needs_review`
  - hold_expires_at < now()
- Update status to `needs_review_expired` (preferred)
  - If enum update is hard, fallback: `cancelled` + reason “Hold expired — auto-released”
- Ensure expired holds **no longer block availability**
- Log releases into:
  - `hold_release_logs` table OR `email_ingest_logs` with provider `hold-timeout-release`

### UI Requirements

- Needs Review tab shows countdown (time remaining)
- When expired shows badge: **Expired — requires manual review**
- Calendar shows “Held” while active, and normal availability after expiry

---

## 4) Cleaning Timer Automation (Your new requested logic)

**Goal:** When checkout happens, room stays “Cleaning” or “Maintenance” for **90 minutes**, then becomes available automatically.

### DB Migration

Add to rooms:

- `auto_cleaning_minutes int default 90`
- `cleaning_until timestamptz null`

On checkout:

- booking: `status = checked_out`, `checked_out_at = now()`
- room: set `housekeeping_status = 'cleaning'`
- room: set `cleaning_until = now() + auto_cleaning_minutes minutes`
- room: set `last_checkout_at = now()`

### Scheduled Job

Edge function or pg_cron runs every 10–15 minutes:

- find rooms where:
  - housekeeping_status='cleaning'
  - cleaning_until < now()
- set housekeeping_status='clean'
- clear cleaning_until

### UI

- Rooms tab shows countdown: “Cleaning — 1h 12m left”
- Availability calendar should treat room as:
  - **available inventory** depends on booking rules, BUT you can also show a visual “Cleaning” badge (operational)

> Important: availability blocking stays based on booking status/date range. Cleaning is operational status, not booking block.

---

## 5) Rooms Page: Fully Derived Status (No “rooms.status=occupied” hacks)

Derive room display based on:

- housekeeping_status + maintenance
- bookings in active statuses and `[check_in, check_out)` rule

Display states:

- Occupied (checked_in and today < check_out)
- Due Out Today (checked_in and check_out = today; before checkout_time)
- Arriving Today (confirmed and check_in=today)
- Cleaning (housekeeping_status='cleaning')
- Dirty (housekeeping_status='dirty')
- Inspected / Clean
- Maintenance (room.status = maintenance)

---

## 6) Guests must be complete in Settings (No broken flows)

### Navigation + Routes

- Remove Guests from main nav
- Add Settings tab: `Guests`
- `/guests` route redirects to `/settings?tab=guests`
- Back buttons always go back to Settings Guests

### Guest Details Requirements

When you click a guest:

- Show full guest details
- Show booking history timeline
- Show **services purchased** + totals (must be accurate per booking)
- Show revenue summary per guest
- VIP + blacklist toggles (admin)
- Passport section with secure photo

---

## 7) Guest Retention (Hide after 1 month, soft delete after 13 months)

### DB

Ensure guests has:

- `archived_at timestamptz`
- `deleted_at timestamptz`

### Rules

- Auto-archive: 1 month after last checkout
- Auto-soft-delete: 13 months after last checkout
- Keep bookings/reports intact (do not break history)

### UI

Filters:

- Active / Archived / Deleted  
Admin actions:
- Restore archived/deleted

### Scheduled Job

Daily job per property.

---

## 8) Booking Form: Nationality + Phone Code (Must be “All countries”)

### UI

- Nationality / Country selector (full list + dial code)
- Auto fill phone code:
  - Sri Lanka +94, India +91, etc for all countries
- Manual override allowed

### Storage fields

Store in guests:

- `country`
- `phone_country_code`
- `phone_number`
- `phone_e164` computed

Also store nationality/country on guest.

---

## 9) USD/LKR Dual Display + FX Rate Update Fix

### DB

Add to property_inventory_settings:

- `fx_usd_lkr_rate numeric default 310`
- `fx_updated_at timestamptz`

### UI

- Everywhere money appears:
  - show LKR as primary
  - show USD approx under it using latest FX rate
- Dashboard FX bug fix:
  - always fetch latest rate from DB (no stale caching)

---

## 10) Testing Tool: Danger Zone Clear Property Data (You’re testing now)

Must remain:

- admin-only
- requires password confirm
- double confirmation
- per selected property only
- logs action to audit_logs

Must clear:

- guests, bookings, services usage, invoices/payments, availability history, reports/revenue, notifications, channel sync logs (property-scoped)

Must NOT delete:

- property itself
- rooms definitions (optional: reset housekeeping status)
- staff users

---

# Phase 2 — Operational Upgrades (Next)

## 11) Front Desk Speed Mode

Route `/front-desk`  
Shows:

- Today Arrivals
- In-house
- Today Departures
- Pending payments

Card quick actions:

- check-in/out
- add service
- take payment
- extend stay
- cancel/no-show

Auto guest detection:

- match by phone/passport/NIC → link existing guest

---

## 12) Overbooking / Channel Sync Safety

- overlap checks + hard DB guard
- 30-second booking lock
- channel manager dashboard:
  - last sync time, sync errors, conflicts detected
- optional inventory safety buffer

---

## 13) Housekeeping Board

Board statuses:  
Dirty → Cleaning → Clean → Inspected  
Fields:  
assigned_to, cleaning_started_at, cleaning_completed_at, inspected_by  
Rules:  
checkout → Dirty (or Cleaning if using timer workflow)

---

## 14) Notifications System

In-app bell + dashboard alerts:

- arrivals
- checkout due 11:00
- hold expiring
- cleaning completed
- cancellation received
- sync failures

---

## 15) Data Quality System

- duplicate detection (same phone/passport)
- merge tool (admin)
- required fields per guest_type
- booking archive view older than N days (configurable)
- improved search (name/phone/passport/NIC/booking ID/room)

---

# Phase 3 — Business/Finance (Later)

## 16) Booking Transactions Ledger (Operational Money)

Create `booking_transactions` table:  
payment/refund/commission/adjustment  
Show booking balance:

- total, paid, outstanding

---

## 17) Accounting Layer (Double Entry)

Tables:

- ledger_accounts
- ledger_entries
- ledger_lines

Rules:

- all entries balanced (sum debit = sum credit)
- multi-property safe

Auto posting:

- booking confirmed (AR / Revenue)
- tax (Tax payable)
- commission (Commission expense / OTA payable)
- payments (Cash/Bank/Card / AR)
- refunds reverse entries

---

# Phase 4 — System Health Monitor (Admin, Settings)

## 18) System Health Monitor + Accounting Diagnostics

Route:  
`/settings?tab=system-health`

Admin-only button:  
“Run Full System Check”

Backend RPC:  
`system_health_check(p_property_id uuid)` returns JSON PASS/FAIL per check.

Must include checks:

- Property isolation
- Overlap prevention
- iCal idempotency
- Commission accuracy
- Tax engine
- Card surcharge
- Cleaning timer job
- Hold auto release job
- FX sync freshness
- Guest retention job
- Accounting reconciliations (ledger balance, revenue/tax/commission/payment reconciliation)

Optional:

- store history in system_health_logs

---

# Deliverables Checklist (Must Complete)

- Safe migrations + no breaking changes
- Fix calendar bug end-to-end (your screenshot case)
- Hold system fully working + scheduled
- Cleaning timer fully working + scheduled
- Viewer role locked down in RLS (no API bypass)
- Guests in Settings fully wired + full detail + services purchased
- Guest retention scheduled job
- FX dual display + rate updates
- Test checklist in PR summary

&nbsp;

(Run a full system code ckeck and verify it to me)

(check there is the wrond codes are there)

(dont miss on this plan i need everything on this plan)

---


# Updated Plan: Kings Bay PMS — Implementation Status & Remaining Work

## Summary of Changes Since Original Plan

The project has made significant progress. This updated plan reflects what has been completed, what is partially done, and what remains.

---

## Implementation Status

### COMPLETED (Phase 1)

| # | Item | Status |
|---|------|--------|
| 1 | **Viewer Role RLS** — `is_write_staff()` function created, all major tables updated with write-restricted policies | DONE |
| 2 | **Availability Calendar Fix** — `isDateInBookingRange()` using string comparison `[check_in, check_out)`, applied in both calendars | DONE |
| 3 | **Hybrid Hold System** — `hold_expires_at` on bookings, `hold-timeout-release` edge function, countdown UI in BookingTable, calendar respects expired holds | DONE |
| 4 | **Cleaning Timer** — `cleaning_until` + `auto_cleaning_minutes` on rooms, `cleaning-timer-release` edge function, countdown in Rooms page, checkout sets cleaning status | DONE |
| 5 | **Rooms Derived Status** — Rooms page derives Occupied/Due Out/Arriving/Cleaning/Dirty/Clean from bookings + housekeeping | DONE |
| 6 | **Guests in Settings** — Guests tab in Settings, `/guests` redirect, guest details page with booking history | DONE |
| 7 | **Guest Retention** — `archived_at`/`deleted_at` fields, `guest-retention` edge function, Active/Archived/Deleted filters | DONE |
| 8 | **Nationality + Phone Code** — Country selector with dial codes, `countryData.ts` with full list | DONE |
| 9 | **FX Rate System** — `fx_usd_lkr_rate` in DB, `CurrencyDisplay` component, `useFxRate` hook, `fx-rate-update` edge function, dual LKR/USD display | DONE |
| 10 | **Danger Zone** — Admin-only, password confirmation, per-property clear with audit logging | DONE |

### COMPLETED (Phase 2)

| # | Item | Status |
|---|------|--------|
| 11 | **Front Desk Speed Mode** — `/front-desk` route with arrivals, in-house, departures, payments, quick actions (check-in/out, payment, cancel, no-show, extend stay, move room) | DONE |
| 12 | **Channel Manager / Overbooking Safety** — Channel manager page, iCal import/export, booking-email-inbound, needs_review flow, channel sync edge function | DONE |
| 14 | **Notifications System** — In-app bell, notification preferences, `create-notification` edge function, `notification-cleanup` edge function | DONE |

### COMPLETED (Phase 3)

| # | Item | Status |
|---|------|--------|
| 16 | **Booking Transactions Ledger** — `booking_transactions` table with RLS, TransactionsTab component, payment/refund/commission tracking, realtime subscription | DONE |
| 17 | **Accounting Layer** — `ledger_accounts`, `ledger_entries`, `ledger_lines` tables, `ledgerUtils.ts` with auto-posting (booking confirmed, commission, payments), FinancialSummary report | DONE |

### COMPLETED (Phase 4)

| # | Item | Status |
|---|------|--------|
| 18 | **System Health Monitor** — `SystemHealthSettings` component at `/settings?tab=system-health`, admin-only, checks FX freshness, scheduled jobs, payment reconciliation | DONE |

### COMPLETED (Additional — Not in Original Plan)

| Item | Status |
|------|--------|
| **Guest Email System** — `guest-email` edge function via Resend API, booking confirmation / pre-arrival / checkout summary templates, auto-send on booking create and check-in | DONE |
| **Guest Feedback System** — Feedback dialog, display component, feedback report, dashboard widget | DONE |
| **Printable Invoice** — `PrintableInvoice` component with react-to-print | DONE |
| **PWA Support** — Service worker, manifest, offline capability | DONE |
| **Booking Extend Stay / Move Room** — Dialog components for operational flexibility | DONE |
| **Add Service Dialog** — Service selector with category-based filtering | DONE |
| **Reports** — Occupancy, Revenue, Financial Summary, Feedback reports | DONE |
| **Mobile Responsive** — Bottom nav, responsive tables, mobile-friendly settings tabs | DONE |

---

## Remaining / Partially Complete

| # | Item | Status | Notes |
|---|------|--------|-------|
| 13 | **Housekeeping Board** | NOT STARTED | Dedicated board view with drag-drop status transitions, assigned_to, inspected_by fields |
| 15 | **Data Quality System** | NOT STARTED | Duplicate detection, merge tool, improved search across name/phone/passport/NIC/booking ID |
| — | **Guest Details: Services Purchased** | VERIFY | Guest detail page exists but need to confirm services purchased + totals are shown accurately per booking |
| — | **Passport Photo Upload** | VERIFY | Passport section may exist but secure photo storage needs verification |

---

## Recommended Next Priorities

1. **Housekeeping Board** — Visual board for housekeeping workflow (Dirty -> Cleaning -> Clean -> Inspected) with staff assignment
2. **Data Quality** — Duplicate guest detection and merge tool for admin
3. **Guest Detail Verification** — Ensure services purchased totals are accurate on guest detail page
4. **End-to-End Testing** — Verify all scheduled edge functions (cleaning timer, hold timeout, guest retention, FX rate) are running on schedule


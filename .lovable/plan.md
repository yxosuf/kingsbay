# Kings Bay PMS — Implementation Status & Remaining Work

## Summary

The project has made significant progress. This plan reflects current status.

---

## COMPLETED

### Phase 1 — Critical Fixes

| # | Item | Status |
|---|------|--------|
| 1 | **Viewer Role RLS** — `is_write_staff()`, write-restricted policies on all major tables | ✅ |
| 2 | **Availability Calendar** — `isDateInBookingRange()` with `[check_in, check_out)` string comparison | ✅ |
| 3 | **Hybrid Hold System** — `hold_expires_at`, `hold-timeout-release` edge function, countdown UI | ✅ |
| 4 | **Cleaning Timer** — `cleaning_until` + `auto_cleaning_minutes`, `cleaning-timer-release` edge function | ✅ |
| 5 | **Rooms Derived Status** — Occupied/Due Out/Arriving/Cleaning/Dirty/Clean from bookings + housekeeping | ✅ |
| 6 | **Guests in Settings** — Tab in Settings, `/guests` redirect, guest details with booking history | ✅ |
| 7 | **Guest Retention** — `archived_at`/`deleted_at`, `guest-retention` edge function, filters | ✅ |
| 8 | **Nationality + Phone Code** — Country selector with dial codes, `countryData.ts` | ✅ |
| 9 | **FX Rate System** — `CurrencyDisplay`, `useFxRate`, `fx-rate-update` edge function | ✅ |
| 10 | **Danger Zone** — Admin-only, password confirm, per-property clear, audit logging | ✅ |

### Phase 2 — Operational

| # | Item | Status |
|---|------|--------|
| 11 | **Front Desk Speed Mode** — Arrivals/in-house/departures, quick actions | ✅ |
| 12 | **Channel Manager** — iCal import/export, email inbound, needs_review flow | ✅ |
| 14 | **Notifications** — Bell, preferences, create/cleanup edge functions | ✅ |

### Phase 3 — Finance

| # | Item | Status |
|---|------|--------|
| 16 | **Booking Transactions Ledger** — `booking_transactions` table, TransactionsTab | ✅ |
| 17 | **Accounting Layer** — `ledger_accounts/entries/lines`, auto-posting, FinancialSummary | ✅ |

### Phase 4

| # | Item | Status |
|---|------|--------|
| 18 | **System Health Monitor** — `/settings?tab=system-health`, admin-only checks | ✅ |

### Additional (Not in Original Plan)

| Item | Status |
|------|--------|
| Guest Email System (Resend) | ✅ |
| Guest Feedback System | ✅ |
| Printable Invoice | ✅ |
| PWA Support | ✅ |
| Extend Stay / Move Room | ✅ |
| Add Service Dialog | ✅ |
| Reports (Occupancy, Revenue, Financial, Feedback) | ✅ |
| Mobile Responsive (bottom nav, responsive tables/tabs) | ✅ |

---

## Remaining

| # | Item | Status | Notes |
|---|------|--------|-------|
| 13 | **Housekeeping Board** | TODO | Drag-drop status transitions, assigned_to, inspected_by |
| 15 | **Data Quality System** | TODO | Duplicate detection, merge tool, improved search |
| — | **Guest Details: Services Purchased** | VERIFY | Confirm totals shown per booking |
| — | **Passport Photo Upload** | VERIFY | Secure storage verification needed |

---

## Next Priorities

1. Housekeeping Board (Dirty → Cleaning → Clean → Inspected)
2. Data Quality (duplicate detection + merge)
3. Guest Detail verification (services purchased totals)
4. E2E testing of scheduled edge functions



# Phase 3: Business/Finance Module — Implementation Plan

## Scope Assessment

The system already has a working payments flow (payments table → invoices → payment_status). Phase 3 adds **booking transactions tracking**, **double-entry ledger**, **FX dual display enhancements**, and **System Health integration**.

---

## 1. Database Schema (3 new tables + 1 enum)

### Migration SQL

**Table: `booking_transactions`** — Records every financial event on a booking.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | gen_random_uuid() |
| booking_id | uuid FK→bookings | NOT NULL |
| transaction_type | enum(payment, refund, commission, adjustment) | NOT NULL |
| amount | numeric | NOT NULL |
| currency | text | DEFAULT 'LKR' |
| method | payment_method enum | nullable |
| notes | text | nullable |
| created_by | uuid | nullable |
| property_id | uuid FK→properties | nullable |
| created_at | timestamptz | DEFAULT now() |

**Table: `ledger_accounts`** — Chart of accounts.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | gen_random_uuid() |
| code | text UNIQUE | e.g. '1100', '4000' |
| name | text | e.g. 'Accounts Receivable' |
| account_type | enum(asset, liability, equity, revenue, expense) | NOT NULL |
| is_system | boolean | DEFAULT true |
| property_id | uuid FK→properties | nullable (null = global) |
| created_at | timestamptz | DEFAULT now() |

**Table: `ledger_entries`** — Journal entry header.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | gen_random_uuid() |
| booking_id | uuid FK→bookings | nullable |
| transaction_id | uuid FK→booking_transactions | nullable |
| description | text | NOT NULL |
| property_id | uuid FK→properties | NOT NULL |
| created_by | uuid | nullable |
| created_at | timestamptz | DEFAULT now() |

**Table: `ledger_lines`** — Individual debit/credit lines per entry.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | gen_random_uuid() |
| entry_id | uuid FK→ledger_entries | NOT NULL |
| account_id | uuid FK→ledger_accounts | NOT NULL |
| debit | numeric | DEFAULT 0 |
| credit | numeric | DEFAULT 0 |

**New enum:** `CREATE TYPE public.transaction_type AS ENUM ('payment','refund','commission','adjustment');`
**New enum:** `CREATE TYPE public.account_type AS ENUM ('asset','liability','equity','revenue','expense');`

**RLS:** All 4 tables get `is_staff()` for SELECT, `is_write_staff()` for INSERT/UPDATE, `is_admin()` for DELETE. Enable realtime on `booking_transactions`.

**Seed ledger_accounts** with standard chart of accounts (8-10 accounts): Cash, Bank, Card Receipts, Accounts Receivable, Room Revenue, Service Revenue, Tax Payable, OTA Commission Expense, OTA Payable.

---

## 2. Enhanced Payment Dialog

Update `PaymentDialog.tsx` to:
- **Pre-fill amount** with outstanding balance
- **Fetch FX rate** from `property_inventory_settings` and show USD equivalent
- **Create booking_transaction** record alongside the payment insert
- **Auto-post ledger entries**: Debit Cash/Bank/Card, Credit AR
- Show dual currency (LKR primary, USD secondary) in the outstanding balance display

---

## 3. Booking Transactions Tab on BookingDetails

Add a **"Transactions"** section to `BookingDetails.tsx`:
- Query `booking_transactions` WHERE booking_id = current booking
- Display: type badge, amount (LKR + USD), method, date, notes
- Show running balance: total_amount - sum(payments) + sum(refunds)
- Include payment/outstanding summary card with FX display

---

## 4. Auto-Post Ledger Events

Create a utility module `src/lib/ledgerUtils.ts` with functions:
- `postBookingConfirmed(bookingId, amount, taxAmount, propertyId)` — DR: AR, CR: Revenue + Tax Payable
- `postPayment(transactionId, amount, method, propertyId)` — DR: Cash/Bank/Card, CR: AR
- `postCommission(bookingId, commissionAmount, propertyId)` — DR: Commission Expense, CR: OTA Payable
- `postRefund(transactionId, amount, method, propertyId)` — Reverse payment entry

These are called from:
- Checkout flow in `BookingDetails.tsx` (booking confirmed → revenue)
- `PaymentDialog.tsx` (payment)
- Future refund UI

---

## 5. FX Dual Display Enhancement

Create a reusable `CurrencyDisplay` component:
- Props: `amount: number`, `fxRate: number | null`
- Renders: `LKR 45,000` with `~$145 USD` underneath
- Use in: PaymentDialog, BookingDetails billing summary, Front Desk pending payments, Reports

Create a hook `useFxRate(propertyId)` that fetches and caches the FX rate.

---

## 6. System Health Monitor — Phase 3 Checks

Add to `SystemHealthSettings.tsx`:
- **Ledger Balance Check**: Query `SELECT entry_id, SUM(debit) - SUM(credit) FROM ledger_lines GROUP BY entry_id HAVING SUM(debit) != SUM(credit)` — should return 0 rows
- **Transaction Coverage**: Check bookings with payments in `payments` table also have corresponding `booking_transactions` records
- **FX Rate** check already exists

---

## 7. Files to Create/Modify

**New files:**
- `src/lib/ledgerUtils.ts` — Ledger posting functions
- `src/hooks/useFxRate.ts` — FX rate hook
- `src/components/ui/CurrencyDisplay.tsx` — Dual currency component
- `src/components/booking/TransactionsTab.tsx` — Transactions list for BookingDetails

**Modified files:**
- `src/components/front-desk/PaymentDialog.tsx` — FX display, transaction creation, ledger posting
- `src/pages/BookingDetails.tsx` — Add Transactions section, use FX hook
- `src/components/settings/SystemHealthSettings.tsx` — Add ledger balance + transaction coverage checks
- `src/pages/FrontDesk.tsx` — FX display in pending payments

**Migration:** 1 migration for all 4 tables + 2 enums + RLS policies + seed data

---

## 8. Implementation Order

1. Database migration (tables, enums, RLS, seed accounts)
2. `useFxRate` hook + `CurrencyDisplay` component
3. `ledgerUtils.ts` utility functions
4. Enhanced `PaymentDialog` with transactions + ledger
5. `TransactionsTab` component + integrate into `BookingDetails`
6. Update checkout flow to post revenue ledger entries
7. System Health Monitor ledger checks
8. FX display in Front Desk pending payments


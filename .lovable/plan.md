Comprehensive Booking System Enhancement Plan (Enhanced)

## Scope Overview


| Feature                        | Key Changes                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------- |
| **Card Bank Fee**              | Auto-add 3% for card payments; post to ledger; show on invoice.                 |
| **Airbnb Prepaid**             | Mark Airbnb bookings as paid automatically; create invoice and ledger entry.    |
| **Guest Count Split**          | Separate “Adults” and “Children” fields; keep total for backward compatibility. |
| **Passport Photo OTA Warning** | Soft warning for OTA bookings if no passport photo uploaded; non-blocking.      |


---

## 1. Auto-Add 3% Card Bank Fee

**Database:**

- Add `bank_fee_amount` column to `bookings` table (nullable numeric, default 0).

**Logic / UI:**

- In `PaymentDialog.tsx`, when payment method = `card`:
  - Calculate `bank_fee_amount = 3% of payment amount`.
  - Display as separate line item: “3% card bank fee”.
  - Update `total_payment = payment_amount + bank_fee_amount`.
- In `Invoice/PrintableInvoice.tsx`:
  - Show bank fee line item.
- In ledger (`ledgerUtils.ts`):
  - Post bank fee to new account: `5100 - Bank Fees Expense`.

**Files to Modify:**

- `PaymentDialog.tsx`
- `PrintableInvoice.tsx`
- `BookingDetails.tsx`
- `ledgerUtils.ts`
- Migration for `bank_fee_amount`
- Ledger account seed

---

## 2. Airbnb Bookings Auto-Marked as Paid

**Logic:**

- After creating an Airbnb booking:
  - Create invoice (room + services + tax)
  - Create `booking_transaction` type `payment`, method `online`, notes: “Airbnb prepaid”
  - Mark invoice as `paid`
  - Post payment to ledger

**UI:**

- Front Desk / Booking Details: show “Paid” badge instead of “Pending Payment”.

**Files to Modify:**

- `NewBooking.tsx` (main logic)
- `FrontDesk.tsx`, `BookingDetails.tsx` (badge display)

---

## 3. Split Adults & Children Count

**Database:**

- Add `num_adults` (default 1) and `num_children` (default 0) columns to `bookings`.
- Keep `num_guests = num_adults + num_children` for backward compatibility.

**UI / Logic:**

- `NewBooking.tsx`: replace “Number of Guests” with separate “Adults” and “Children” fields.
- On save: `num_guests = num_adults + num_children`.
- Display format: “2A + 1C” in Booking Table, Booking Card, Booking Details.

**Files to Modify:**

- `NewBooking.tsx`
- `BookingDetails.tsx`
- `BookingTable.tsx`
- `BookingCard.tsx`
- Migration

---

## 4. Passport Photo Soft Warning for OTA Bookings

**Logic:**

- OTA sources: `Booking.com`, `Airbnb` (future: `Expedia`, `Agoda`, etc.)
- If no passport photo uploaded, display **amber warning banner**: “Passport photo recommended for OTA bookings”
- **Do not block booking creation**

**Optional Enhancements:**

- Log missing passport in booking notes (audit-friendly)
- Keep field optional for walk-ins/direct bookings

**Files to Modify:**

- `NewBooking.tsx` (UI + logic)

---

## 5. Role Permissions & Access Control Update

**Roles:**


| Role                | Access                                                                                          |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| **Admin**           | Full access: bookings, rooms, services, staff, system settings                                  |
| **Manager**         | Can manage bookings, view reports, update room status. Cannot manage staff/system settings      |
| **Front Desk**      | Can create/edit bookings, check-in/out guests, add services. Cannot access reports or settings. |
| **Viewer**          | Read-only: dashboard, bookings, availability, guests, reports. Cannot create/edit/delete        |
| **Custom (Future)** | Support adding granular permissions: OTA management, financial reports, service management      |


**Logic / UI:**

- Sidebar: hide tabs not permitted for role (Dashboard, Front Desk, Reports, Settings)
- Booking creation/editing restricted by role
- Passport/photo, card fee, prepayment logic respect role permissions
- Future-proof: create `permissions` table for granular control

**Files to Modify:**

- `AppSidebar.tsx` (hide restricted tabs)
- `NewBooking.tsx` / `BookingDetails.tsx` (enforce role permissions)
- `Settings.tsx` (roles management UI)

---

## 6. Implementation Order (Safe Flow)

1. **Database migrations**
  - `num_adults`, `num_children`, `bank_fee_amount`, ledger account seed
2. **Role & permissions update**
  - Update `permissions` logic before OTA/booking features
3. **NewBooking.tsx updates**
  - Adults/children split, Airbnb auto-pay, OTA passport warning
4. **PaymentDialog.tsx update**
  - Card fee calculation and invoice integration
5. **BookingDetails.tsx / BookingTable.tsx / BookingCard.tsx updates**
  - Display formats, badge updates, role-based access
6. **Invoice & Ledger**
  - Confirm bank fee and OTA prepayments post correctly
7. **Testing**
  - Walk-in, direct, OTA bookings
  - Card payments and refunds
  - Role restrictions
  - Ledger and invoice correctness

---

✅ **Outcome:**

- Accurate guest info: adults/children, passport photo tracking
- Correct payment handling: OTA prepayment, card bank fees
- Proper role-based access
- Ledger and invoice integrity
- Soft warnings for missing optional info
- Future-proof for adding more OTAs and granular permissions
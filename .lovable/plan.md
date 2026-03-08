# Complete Master Plan: Staff + Walk-in + Guest Portal + Rate Engine

---

## 1️⃣ System Architecture Overview

**Roles:**


| Role          | Access                                                                                   |
| ------------- | ---------------------------------------------------------------------------------------- |
| Staff         | Full control: create/edit bookings, check-in/out, rate management, occupancy, audit logs |
| Guest         | Self-service: register/login, browse rooms, create bookings, view/cancel own bookings    |
| Walk-in Guest | Special staff workflow: quick check-in, no prior account needed                          |


**Key Components:**

- `rateEngine.ts` → all pricing logic, discounts, occupancy-based dynamic pricing
- `NewBooking.tsx` → staff + walk-in bookings
- `GuestBooking.tsx` → guest self-service bookings
- `RateCalendar.tsx` → bulk editing + overrides
- `RateManagementSettings.tsx` → occupancy rules, audit log
- Database tables: `bookings`, `guests`, `rate_plans`, `discount_codes`, `occupancy_pricing_rules`, `rate_change_logs`

---

## 2️⃣ Database Changes & RLS

**Tables to add / modify:**


| Table                     | Changes                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `bookings`                | Add `rate_plan_id`, `discount_code_id`, `discount_amount`, `source` (direct/website/walkin), `checked_in_at` |
| `guests`                  | Add `auth_user_id` (link to auth.users)                                                                      |
| `occupancy_pricing_rules` | New: occupancy thresholds & modifiers                                                                        |
| `rate_change_logs`        | Track changes in rate plans, seasonal rules, overrides, discount codes                                       |


**RLS Policies:**

- Staff: full access (`is_staff()`)
- Guests: access only to own profile & bookings (`auth_user_id`)
- Walk-in bookings: handled by staff, no guest auth required

**Helper Function:**

```sql
CREATE FUNCTION public.is_guest() RETURNS boolean AS $$
SELECT auth.uid() IS NOT NULL
AND NOT public.is_staff()
AND EXISTS (SELECT 1 FROM public.guests WHERE auth_user_id = auth.uid())
$$ LANGUAGE sql STABLE SECURITY DEFINER;

```

---

## 3️⃣ Staff Booking & Walk-in Flow

**Front Desk / Staff Booking**

1. Navigate to `/bookings/new`
2. Search or create guest profile
3. Select room and rate plan → `calculateStayTotal()`
4. Optionally apply discount code
5. Submit → status = `confirmed`

**Walk-in Guest Flow**

1. Front desk clicks **“Walk-in Guest”** → `/bookings/new?walkin=true`
2. Check-in date auto-set to today, toggle “Check-in Immediately” ON
3. Booking status = `checked_in`, `checked_in_at` recorded
4. Room `housekeeping_status` = `occupied`
5. Source = `walkin`

**Files affected:**


| File                         | Changes                                                   |
| ---------------------------- | --------------------------------------------------------- |
| `NewBooking.tsx`             | Walk-in toggle, auto-set dates, discount code integration |
| `FrontDesk.tsx`              | “Walk-in Guest” button                                    |
| `rateEngine.ts`              | Occupancy pricing, discount codes                         |
| `RateCalendar.tsx`           | Bulk edit, overrides                                      |
| `RateManagementSettings.tsx` | Occupancy tab, audit log                                  |


---

## 4️⃣ Rate Engine & Dynamic Pricing

**Features:**

- Base rates + seasonal rules + day-of-week modifiers
- Discount codes applied per booking
- Occupancy-based pricing dynamically adjusts nightly rates
- Audit logging of all changes to rates, overrides, and discount codes

**Integration Points:**

- **Staff bookings** → automatic in `NewBooking.tsx`
- **Walk-in bookings** → same `calculateStayTotal()` logic
- **Guest bookings** → same `calculateStayTotal()` logic, read-only display for price breakdown

**Sample Nightly Breakdown Table:**


| Date       | Base Rate | Adjustments   | Final Rate |
| ---------- | --------- | ------------- | ---------- |
| 2026-06-01 | 18,000    | Weekend +20%  | 21,600     |
| 2026-06-02 | 18,000    | Seasonal +15% | 20,700     |


---

## 5️⃣ Guest Self-Service Portal

**Pages & Routes:**


| Route                   | Purpose                                                                    |
| ----------------------- | -------------------------------------------------------------------------- |
| `/guest/register`       | Sign-up (auto-create guest profile)                                        |
| `/guest/login`          | Login form                                                                 |
| `/guest/dashboard`      | Profile, upcoming bookings, history                                        |
| `/guest/book`           | Booking wizard: select property → dates → room → rate → discount → confirm |
| `/guest/bookings/:id`   | Booking details, price breakdown                                           |
| `/guest/reset-password` | Password reset                                                             |


**Guest Booking Flow:**

1. Select property & dates
2. Check room availability → apply rate engine
3. Optional discount code
4. Confirm booking → status = `confirmed`, source = `website`
5. Confirmation email sent via edge function

**Auth & Security:**

- Guests cannot access staff pages
- RLS policies ensure guests see only their own data
- Password hashing, email verification, rate limiting handled by auth system

**Files:**


| File                      | Action             |
| ------------------------- | ------------------ |
| `GuestRegister.tsx`       | Create             |
| `GuestLogin.tsx`          | Create             |
| `GuestDashboard.tsx`      | Create             |
| `GuestBooking.tsx`        | Create             |
| `GuestBookingDetails.tsx` | Create             |
| `GuestResetPassword.tsx`  | Create             |
| `GuestLayout.tsx`         | New layout         |
| `useAuth.tsx`             | Add `isGuest` flag |
| `App.tsx`                 | Add guest routes   |


---

## 6️⃣ Notifications & Emails

- Staff booking confirmation → internal notification
- Walk-in → internal notification only
- Guest booking → confirmation email, optional SMS reminder

---

## 7️⃣ Audit Logging

- Track all changes in `rate_change_logs`
- Includes: rate plan, seasonal rules, day-of-week rules, overrides, discount codes
- Staff and guest actions logged separately for compliance

---

## 8️⃣ Out of Scope / Future Features

- OTA channel syncing ([Booking.com](http://Booking.com) / Airbnb)
- Length-of-stay discounts & derived rate plans
- Social login for guests
- Guest-initiated cancellations beyond policy

---

## ✅ Benefits of This Master Plan

- Unified **rate engine** for all booking types
- **Walk-in check-in** fully integrated with front desk
- **Guest portal** supports registration, login, and self-service bookings
- **Audit logs** ensure traceability for all pricing changes
- **RLS & auth** enforce proper access control
- Scalable: multi-property, multi-role, future channel integration
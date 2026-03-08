# Lovable Hotel Management – Master Implementation Plan

## 1. Core Rate Engine & Pricing System

### Current Capabilities

- `rateEngine.ts` handles base rates, seasonal rules, day-of-week rules, and discount codes
- NewBooking integrates `calculateStayTotal` and shows nightly breakdown
- Rate plan selector and single-cell override editing in Rate Calendar

### Missing / To Add

1. **Bulk Rate Editing**
  - Date range selection → increase/decrease by % or set absolute price
  - Close/open dates
  - Upsert to `rate_overrides`
2. **Occupancy-Based Dynamic Pricing**
  - New `occupancy_pricing_rules` table
  - `calculateNightRate` considers occupancy thresholds
3. **Audit Logging**
  - Log all rate plan / discount / override changes in `rate_change_logs`
  - New “Change Log” tab in Rate Management Settings

**Files / Tables**


| File                                                 | Action                                                                    |
| ---------------------------------------------------- | ------------------------------------------------------------------------- |
| `src/lib/rateEngine.ts`                              | Occupancy modifiers, discount handling                                    |
| `src/pages/RateCalendar.tsx`                         | Bulk editing UI                                                           |
| `src/components/settings/RateManagementSettings.tsx` | Tabs: Rate Plans, Seasonal, Day of Week, Discounts, Occupancy, Change Log |
| DB                                                   | `rate_overrides`, `occupancy_pricing_rules`, `rate_change_logs`           |


---

## 2. Walk-In Booking (Front Desk)

### Key Features

- "Walk-in Guest" button in **Front Desk page**
- `/bookings/new?walkin=true` pre-fills check-in date as today, sets status `checked_in`
- Auto-set room `housekeeping_status = 'occupied'`
- Optional toggle “Check-in Immediately”

**Files / Changes**


| File                       | Action                                       |
| -------------------------- | -------------------------------------------- |
| `src/pages/NewBooking.tsx` | Walk-in detection, toggle, auto-set check-in |
| `src/pages/FrontDesk.tsx`  | Add "Walk-in Guest" button                   |


---

## 3. Guest Self-Service Portal

### Features

- Registration, login, password reset
- Dashboard: upcoming bookings, booking history, profile edit
- Booking flow: select property → date → room → rate plan → discount → confirm

### Database & Auth

1. `auth_user_id` in `guests` table
2. RLS policies: guests access only their own bookings/guest info, public rooms/rates
3. DB trigger: auto-create guest profile on registration

**Pages / Files**


| Route                   | Component               | Purpose               |
| ----------------------- | ----------------------- | --------------------- |
| `/guest/register`       | GuestRegister.tsx       | Sign up               |
| `/guest/login`          | GuestLogin.tsx          | Login                 |
| `/guest/dashboard`      | GuestDashboard.tsx      | View bookings/profile |
| `/guest/book`           | GuestBooking.tsx        | Booking flow          |
| `/guest/bookings/:id`   | GuestBookingDetails.tsx | View single booking   |
| `/guest/reset-password` | GuestResetPassword.tsx  | Password reset        |
| `GuestLayout.tsx`       | Layout                  | Guest UI              |


**Auth Changes**

- `isGuest` flag in `useAuth.tsx`
- Separate guest vs staff login entry points

---

## 4. OTA / Channel Integrations (Stub / Future)

### Features

- New **OTA Sync** tab under Rate Management
- DB Table: `ota_integrations` with `api_key`, `status`, `last_rate_push_at`
- Stub implementation (`StubChannelIntegration`) logs actions, ready for real API integration
- “Fake OTA Mode”: generate test bookings to validate rate engine & overbooking prevention

**Files / Changes**


| File                                                 | Action                        |
| ---------------------------------------------------- | ----------------------------- |
| `src/components/settings/RateManagementSettings.tsx` | Add OTA Sync tab              |
| `src/components/settings/OtaSyncTab.tsx`             | Full tab UI                   |
| `src/lib/channelIntegration.ts`                      | Stub integration service      |
| DB                                                   | `ota_integrations` table, RLS |


---

## 5. Booking & Discount Management

- Discount codes applied in **rateEngine** & NewBooking
- Closed dates block booking submissions
- BookingDetails shows **nightly breakdown** and discount info

---

## 6. Security & RLS Policies

- Guests: read/write only their own data, read-only for public rooms/rates
- Staff: normal operations, admin has full CRUD
- OTA keys: masked display, optional future integration
- Passwords: handled by auth provider

---

## 7. Suggested Future Features

- Channel rate sync to live OTAs ([Booking.com](http://Booking.com), Airbnb, Expedia)
- Length-of-stay discounts / derived rate plans
- Guest check-in/check-out via portal
- Analytics & reporting dashboard
- Mobile-friendly guest portal

---

### ✅ Implementation Notes

1. **Feature toggles** for OTA API integration (disabled by default)
2. **Testing & simulation**: fake OTA bookings + walk-in bookings
3. **Unified master layout**: maintain separation for staff vs guest
4. **Audit logging** for all rate changes
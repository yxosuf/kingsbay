

# Villa PMS — Full Master Plan Implementation

## Current State Assessment

After thorough codebase review, here is what's **already working** and what **needs implementation**:

### Already Implemented
- Date logic with `[check_in, check_out)` across calendar, dashboard, overlap checks
- Viewer role (`canWrite` flag, UI disabling)
- Guests under Settings with soft delete
- Danger Zone with password confirmation
- Hold-timeout-release edge function (deployed)
- Nationality/phone code in booking form
- Settings vertical sidebar with tab aliases
- Channel Manager UI improvements
- Booking quick actions (check-in/out/cancel/no-show with timestamps)
- Booking timeline + admin status override
- Hotel settings (checkin/checkout time)
- Dashboard dynamic room availability count

### Security Issue Found
**Viewer role RLS is broken.** Current RLS policies use `is_staff()` for INSERT/UPDATE on bookings, guests, guest_services, etc. Since `is_staff()` returns true for ALL roles including `viewer`, a viewer can bypass UI restrictions and write directly via API. This must be fixed.

---

## Implementation Plan (Phased)

### Phase 1: Critical Fixes & Core Features (This Session)

#### 1. Fix Viewer RLS (Security — CRITICAL)
- **Migration**: Create a `is_write_staff()` function that returns true only for `admin`, `manager`, `front_desk` (excludes `viewer`)
- Update INSERT/UPDATE/DELETE RLS policies on: `bookings`, `guests`, `guest_services`, `invoices`, `payments`, `room_availability`, `audit_logs` (insert), `email_ingest_logs` to use `is_write_staff()` instead of `is_staff()`
- SELECT policies remain `is_staff()` (viewer can read)

#### 2. FX Rate System (USD/LKR Dual Display)
- **Migration**: Add `fx_usd_lkr_rate numeric default 310`, `fx_updated_at timestamptz` columns to `property_inventory_settings`
- **HotelSettings.tsx**: Add FX rate input section — admin can set current USD→LKR rate with "last updated" display
- **Index.tsx (Dashboard)**: Show dual currency on Total Revenue card: primary LKR, secondary `~ $X USD`
- **BookingDetails.tsx**: Show `~ $USD` under total amount
- Remove hardcoded fallback rate logic

#### 3. Rooms Page: Derive Status from Bookings + Housekeeping
- **Rooms.tsx**: Instead of showing static `room.status`, fetch today's bookings and derive room state dynamically:
  - Occupied: `checked_in` booking where today is in `[check_in, check_out)`
  - Due Out Today: `checked_in` booking where `check_out == today`
  - Arriving Today: `confirmed` booking where `check_in == today`
  - Available: no blocking booking AND `housekeeping_status` is `clean`/`inspected`
  - Dirty/Cleaning: based on `housekeeping_status` column
  - Maintenance: `room.status == 'maintenance'`
- Show housekeeping badge on each room card
- Add "Mark Clean" quick action button for staff

#### 4. Checkout Flow: Set Room to Dirty
- **BookingQuickActions.tsx**: On checkout, also update room: `housekeeping_status = 'dirty'`, `last_checkout_at = now()`
- **BookingDetails.tsx**: Same for checkout action on detail page

#### 5. Guest Filters (Active / Archived / Deleted)
- **Migration**: Add `archived_at timestamptz` to guests table (if not exists)
- **GuestsSettings.tsx**: Add filter dropdown: Active (no archived_at, no deleted_at) / Archived (has archived_at, no deleted_at) / All
- Admin can "Restore" archived/deleted guests (clear timestamps)

#### 6. Cleaning Timer System
- **Migration**: Add `auto_cleaning_minutes integer default 90`, `cleaning_until timestamptz` to rooms table
- On checkout: set `cleaning_until = now() + auto_cleaning_minutes interval`
- **Edge Function** `cleaning-timer-release`: Finds rooms where `housekeeping_status='cleaning'` AND `cleaning_until < now()`, sets them to `clean`
- Schedule via pg_cron every 15 minutes
- **Rooms.tsx**: Show cleaning countdown on room cards

### Phase 2: Enhanced Features (Next Session)

#### 7. Front Desk Mode
- New `/front-desk` page with 4 sections: Today Arrivals, In-House, Today Departures, Pending Payments
- Inline quick actions on booking cards
- Eager-load guest + room + balance summary

#### 8. Guest Retention Scheduled Job
- Edge function or pg_cron job running daily
- Archives guests 1 month after last checkout
- Soft-deletes guests 13 months after last checkout

#### 9. System Health Monitor
- New Settings tab: `/settings?tab=system-health`
- RPC function `system_health_check(p_property_id)` that validates:
  - Property isolation integrity
  - Overlap prevention working
  - FX rate freshness
  - Hold release job status
  - Cleaning timer job status

#### 10. Data Quality
- Duplicate guest detection (same phone/passport)
- Merge option for admin
- Required field enforcement based on guest_type

### Phase 3: Future (Subsequent Sessions)

#### 11. Accounting Layer (Ledger)
- `ledger_accounts`, `ledger_entries`, `ledger_lines` tables
- Double-entry balanced entries
- Auto-posting on booking confirm, payment, refund

#### 12. Booking Transactions Table
- Replace single `total_amount` with full transaction history
- Partial payments, refunds, OTA commission tracking

#### 13. Enhanced Notifications
- Staff-facing alerts for overdue checkouts, expired holds, sync failures

---

## Technical Details

### DB Migrations (Phase 1)

```text
Migration 1: is_write_staff() function + update RLS policies
Migration 2: Add fx_usd_lkr_rate, fx_updated_at to property_inventory_settings
Migration 3: Add archived_at to guests
Migration 4: Add auto_cleaning_minutes, cleaning_until to rooms
```

### Files to Edit (Phase 1)

| File | Changes |
|------|---------|
| `src/pages/Rooms.tsx` | Derive room states from bookings, show housekeeping, "Mark Clean" |
| `src/pages/Index.tsx` | Dual currency display on revenue card |
| `src/components/settings/HotelSettings.tsx` | Add FX rate admin input |
| `src/components/settings/GuestsSettings.tsx` | Add Active/Archived/Deleted filter, restore action |
| `src/components/booking/BookingQuickActions.tsx` | Set room dirty on checkout |
| `src/pages/BookingDetails.tsx` | Set room dirty on checkout, show USD amount |
| `supabase/functions/cleaning-timer-release/index.ts` | New edge function |

### New Files (Phase 1)
| File | Purpose |
|------|---------|
| `supabase/functions/cleaning-timer-release/index.ts` | Auto-release cleaning rooms |

### Constraints
- No breaking route changes
- All migrations safe with defaults
- Multi-property isolation preserved in every new query
- Viewer blocked at DB level, not just UI


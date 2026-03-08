# Rate Engine Final Completion Plan (Merged Version)

## Current System Status

Already implemented:

- Rate engine (`rateEngine.ts`) with calculation chain
- Rate plans CRUD
- Seasonal rules
- Day-of-week pricing
- Discount codes
- Rate calendar with single-day overrides
- Booking flow uses `calculateStayTotal`
- Nightly pricing breakdown in booking form
- Rate plan selector in booking form

Remaining work is grouped into **7 structured implementation phases**.

---

# Phase 1 — Database Migration

Add required fields and tables for full pricing tracking.

### Update `bookings` table

Add:

```
rate_plan_id uuid references rate_plans(id)
discount_code_id uuid references discount_codes(id)
discount_amount numeric default 0
price_breakdown jsonb

```

**Important rule**

Booking pricing must be **immutable**.

`price_breakdown` stores the exact nightly pricing used during booking creation so future rate changes do not alter historical bookings.

---

### Create `occupancy_pricing_rules`

```
id uuid
property_id uuid
occupancy_threshold integer (0-100)
modifier_type text (percent | fixed)
modifier_value numeric
is_active boolean default true
created_at timestamp

```

Example rules:


| Occupancy | Modifier |
| --------- | -------- |
| 50%       | none     |
| 70%       | +10%     |
| 90%       | +25%     |


RLS:

```
SELECT → is_staff()
INSERT/UPDATE/DELETE → is_admin()

```

---

### Create `rate_change_logs`

```
id uuid
property_id uuid
user_id uuid
entity_type text
entity_id uuid
action text
old_value jsonb
new_value jsonb
created_at timestamp

```

This logs changes to:

- rate plans
- seasonal rules
- day-of-week rules
- rate overrides
- discount codes

RLS:

```
SELECT → admin only
INSERT → system

```

---

### Indexes

Add composite index:

```
rate_overrides(property_id, room_type, date)

```

Add unique constraint:

```
UNIQUE(property_id, room_type, date)

```

This allows safe **UPSERT bulk updates**.

---

# Phase 2 — Booking Flow Enhancements

### NewBooking.tsx

Add a **discount code input field**.

Flow:

1. User selects:
  - check-in
  - check-out
  - room type
  - guest count
  - rate plan
  - discount code
2. Call:

```
calculateStayTotal(...)

```

3. Display:

- nightly breakdown
- subtotal
- discount
- total

---

### Closed Date Validation

Before booking submission:

Check nightly results:

```
if night.closed === true

```

Show error:

```
"Room is closed for one or more selected dates"

```

Block booking creation.

---

### Discount Code Validation

Before applying discount:

Check usage count.

```
SELECT COUNT(*)
FROM discount_code_usages
WHERE discount_code_id = ?

```

If usage ≥ `max_usage`

Reject code:

```
"Discount code usage limit reached"

```

Also check expiration date.

---

### Booking Creation

When booking is confirmed:

Save:

```
rate_plan_id
discount_code_id
discount_amount
price_breakdown

```

Insert into:

```
discount_code_usages

```

---

# Phase 3 — Booking Details Page

### BookingDetails.tsx

Do **not recalculate pricing**.

Instead display the stored `price_breakdown`.

Example table:


| Date  | Base Rate | Adjustments   | Final Rate |
| ----- | --------- | ------------- | ---------- |
| Jun 1 | 18000     | Weekend +20%  | 21600      |
| Jun 2 | 18000     | Seasonal +15% | 20700      |


Show:

```
Rate Plan
Subtotal
Discount
Total

```

---

# Phase 4 — Bulk Rate Editing (Rate Calendar)

Enhance **RateCalendar.tsx**.

Add **Bulk Edit Mode**.

User selects:

```
Start date → End date
Room type

```

Bulk actions:

- Set price
- Increase by %
- Decrease by %
- Close dates
- Open dates

Implementation:

Insert or update records in `rate_overrides`.

Use:

```
UPSERT
ON CONFLICT(property_id, room_type, date)

```

---

# Phase 5 — Occupancy Based Pricing

Add dynamic pricing to `rateEngine.ts`.

### Step 1

Load rules:

```
fetchOccupancyRules(propertyId)

```

### Step 2

Load occupancy for date range:

```
fetchOccupancyForRange(checkIn, checkOut)

```

Avoid per-night database queries.

---

### Step 3

Inside pricing chain:

```
Base rate
→ Room override
→ Manual override
→ Seasonal rule
→ Day-of-week rule
→ Occupancy rule
→ Extra guest fee
→ Discount

```

Apply occupancy modifier if threshold is reached.

---

### Settings UI

Add **Occupancy Pricing tab** in Rate Management.

Allow CRUD of threshold rules.

---

# Phase 6 — Rate Change Audit Logging

Audit logs should be **database driven**, not frontend.

Create triggers on:

```
rate_plans
seasonal_rules
day_of_week_rules
rate_overrides
discount_codes

```

Trigger:

```
AFTER INSERT
AFTER UPDATE
AFTER DELETE

```

Insert records into `rate_change_logs`.

---

### Settings UI

Add **Change Log tab**.

Display:

```
date
user
entity
action
changes

```

---

# Phase 7 — Performance Optimization

Improve Rate Calendar performance.

Strategies:

Load only:

```
30 days at a time

```

Cache:

```
rate plans
seasonal rules
day-of-week rules

```

Use indexed queries on:

```
rate_overrides

```

---

# Out of Scope (Future Features)

These are intentionally excluded for now.

- OTA price sync ([Booking.com](http://Booking.com) / Airbnb)
- Length-of-stay discounts
- Derived rate plans
- AI demand forecasting

These belong in a **channel manager / revenue management phase**.

---

# Files Affected


| File                                                 | Changes                                 |
| ---------------------------------------------------- | --------------------------------------- |
| Migration SQL                                        | Tables, columns, indexes                |
| `src/lib/rateEngine.ts`                              | Occupancy pricing                       |
| `src/pages/NewBooking.tsx`                           | Discount validation + closed date block |
| `src/pages/BookingDetails.tsx`                       | Display stored breakdown                |
| `src/pages/RateCalendar.tsx`                         | Bulk edit mode                          |
| `src/components/settings/RateManagementSettings.tsx` | Occupancy rules + audit log tab         |
| Database triggers                                    | Audit logging                           |


---

# Final Result

After these steps the PMS will support:

- Rate plans
- Seasonal pricing
- Day-of-week pricing
- Manual overrides
- Discount codes
- Bulk calendar editing
- Occupancy dynamic pricing
- Immutable booking pricing
- Audit logs
- High performance pricing engine

This architecture is comparable to systems used by:

- Cloudbeds
- Hotelogix
- Little Hotelier
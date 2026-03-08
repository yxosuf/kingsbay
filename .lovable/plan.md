# Rate Management System — Final Merged Implementation Plan

## Current State

Currently pricing is flat:

```
rooms.price * nights

```

Each room has a single nightly price and bookings simply multiply by the number of nights.

There is **no support for:**

- rate plans
- seasonal pricing
- weekend pricing
- manual overrides
- promotions
- occupancy pricing

---

# What We Will Build

A **full pricing engine** under:

```
Settings → Rate Management

```

with these capabilities:

- Multiple **rate plans**
- **Seasonal pricing**
- **Day-of-week adjustments**
- **Manual overrides**
- **Discount codes**
- **Length-of-stay discounts (future-ready)**
- **Derived rate plans (optional future feature)**

All pricing will be calculated by a **central pricing engine** used by:

- booking creation
- rate calendar
- guest booking widget
- APIs

---

# Database Schema

We will add **6 new tables** and improve the room-type relationship.

---

# 1. `rate_plans`

Defines pricing strategies.

Example:

- Standard
- Non-Refundable
- Breakfast Included
- Early Bird


| Column          | Type        | Notes  |
| --------------- | ----------- | ------ |
| id              | uuid PK     | &nbsp; |
| property_id     | uuid FK     | &nbsp; |
| name            | text        | &nbsp; |
| description     | text        | &nbsp; |
| base_price      | numeric     | &nbsp; |
| currency        | text        | &nbsp; |
| is_refundable   | boolean     | &nbsp; |
| min_stay        | integer     | &nbsp; |
| max_stay        | integer     | &nbsp; |
| included_guests | integer     | &nbsp; |
| extra_guest_fee | numeric     | &nbsp; |
| is_active       | boolean     | &nbsp; |
| created_at      | timestamptz | &nbsp; |
| updated_at      | timestamptz | &nbsp; |


---

# 2. `rate_plan_room_types`

Links rate plans to room types.

This allows a **rate plan to apply to multiple room types**.


| Column         | Type             |
| -------------- | ---------------- |
| id             | uuid PK          |
| rate_plan_id   | uuid FK          |
| room_type_id   | uuid FK          |
| price_override | numeric nullable |


Unique constraint:

```
(rate_plan_id, room_type_id)

```

---

# 3. `seasonal_rules`

Date-range modifiers for high or low seasons.

Example:

- Christmas
- Summer peak
- Off season


| Column         | Type                     |
| -------------- | ------------------------ |
| id             | uuid PK                  |
| property_id    | uuid FK                  |
| rate_plan_id   | uuid FK nullable         |
| name           | text                     |
| start_date     | date                     |
| end_date       | date                     |
| modifier_type  | text ('percent','fixed') |
| modifier_value | numeric                  |
| priority       | integer                  |
| is_active      | boolean                  |
| created_at     | timestamptz              |
| updated_at     | timestamptz              |


If `rate_plan_id` is null → applies to all plans.

---

# 4. `day_of_week_rules`

Weekend or weekday pricing adjustments.


| Column         | Type             |
| -------------- | ---------------- |
| id             | uuid PK          |
| property_id    | uuid FK          |
| rate_plan_id   | uuid FK nullable |
| day_of_week    | integer (0–6)    |
| modifier_type  | text             |
| modifier_value | numeric          |
| is_active      | boolean          |


Example:

```
Saturday +20%
Sunday +10%

```

---

# 5. `rate_overrides`

Manual price override per date.


| Column       | Type             |
| ------------ | ---------------- |
| id           | uuid PK          |
| property_id  | uuid FK          |
| room_type_id | uuid FK          |
| rate_plan_id | uuid FK nullable |
| date         | date             |
| price        | numeric          |
| closed       | boolean          |
| min_stay     | integer          |
| created_at   | timestamptz      |
| created_by   | uuid             |


Unique constraint:

```
(property_id, room_type_id, date)

```

---

# 6. `discount_codes`

Promo codes for direct bookings.


| Column         | Type                     |
| -------------- | ------------------------ |
| id             | uuid PK                  |
| property_id    | uuid FK                  |
| code           | text                     |
| discount_type  | text ('percent','fixed') |
| discount_value | numeric                  |
| start_date     | date                     |
| end_date       | date                     |
| max_usage      | integer                  |
| is_active      | boolean                  |
| created_at     | timestamptz              |


Unique:

```
(property_id, code)

```

---

# 7. `discount_code_usages`

Tracks usage of promo codes safely.


| Column           | Type        |
| ---------------- | ----------- |
| id               | uuid PK     |
| discount_code_id | uuid FK     |
| booking_id       | uuid FK     |
| used_at          | timestamptz |


Usage count is calculated from this table.

---

# Row Level Security (RLS)

For all rate tables:

### SELECT

```
is_staff()

```

All staff can view pricing.

### INSERT / UPDATE / DELETE

```
is_admin()

```

Only admins can modify rates.

---

# Pricing Engine

File:

```
src/lib/rateEngine.ts

```

Central function used everywhere.

---

## Nightly Rate Calculation

```
calculateNightRate(propertyId, roomTypeId, date, ratePlanId)

```

Steps:

```
1 Get base_price from rate_plan

2 Check rate_plan_room_types override
   if exists → use override

3 Check rate_overrides
   if exists → return override price

4 Apply seasonal rules
   modifier percent/fixed

5 Apply day_of_week rules

6 Apply occupancy pricing
   extra guest fee if guests exceed included_guests

7 Return final nightly rate

```

---

## Stay Total Calculation

```
calculateStayTotal(
 propertyId,
 roomTypeId,
 checkIn,
 checkOut,
 ratePlanId,
 guestCount,
 discountCode
)

```

Process:

```
1 Calculate nightly price for each date
2 Sum subtotal
3 Validate discount code
4 Apply discount
5 Return breakdown

```

Return format:

```
{
 nights: [
   { date, price }
 ],
 subtotal,
 discount,
 total
}

```

---

# UI Components

---

# Settings → Rate Management

New settings section.

```
Settings
  └ Rate Management

```

Subsections:

### Rate Plans

CRUD interface:

```
Name
Base price
Refund policy
Min stay
Extra guest fee
Room type assignment

```

---

### Seasonal Rules

Date range editor.

Example:

```
Summer Peak
Jun 1 → Aug 31
+20%

```

---

### Day-of-Week Pricing

Grid editor:

```
Sun  Mon  Tue  Wed  Thu  Fri  Sat
+0   +0   +0   +0   +0   +10% +20%

```

---

### Discount Codes

CRUD interface:

```
Code
Type
Value
Start/end date
Usage limits

```

---

# Rate Calendar Page

New page:

```
/rate-calendar

```

Sidebar:

```
Dashboard
Bookings
Guests
Rooms
Rate Calendar
Reports
Settings

```

---

### Grid Layout

```
Room Type → rows
Dates → columns

```

Cells display nightly rate.

Example:

```
Deluxe Room

May 1  May 2  May 3
8500   9000   9200

```

---

### Cell Interaction

Click cell → override modal

Options:

```
Override price
Close date
Set min stay

```

---

### Bulk Editing

Drag select multiple dates:

```
Set price
Close dates
Set min stay

```

---

### Color Coding


| Color  | Meaning          |
| ------ | ---------------- |
| Blue   | manual override  |
| Orange | seasonal pricing |
| Purple | weekend pricing  |
| Red    | closed           |
| Gray   | default          |


---

# New Booking Integration

Replace:

```
room.price * nights

```

With:

```
calculateStayTotal()

```

UI improvements:

```
Room Rate Breakdown
-------------------

May 10 → 9000
May 11 → 10000
May 12 → 9500

Subtotal: 28,500
Discount: -2,000
Total: 26,500

```

Discount code field added.

---

# Booking Details Page

Display:

```
Rate Plan
Per-night pricing
Discount applied
Final total

```

---

# Settings Navigation Update

Add:

```
{
 id: 'rates',
 label: 'Rate Management',
 icon: DollarSign,
 description: 'Plans, seasons, pricing',
 adminOnly: true
}

```

---

# Sidebar Update

Add:

```
Rate Calendar

```

Visible for:

```
admin
manager

```

---

# Implementation Order

### 1 Database Migration

Create:

```
rate_plans
rate_plan_room_types
seasonal_rules
day_of_week_rules
rate_overrides
discount_codes
discount_code_usages

```

Add RLS policies.

---

### 2 Pricing Engine

Create:

```
src/lib/rateEngine.ts

```

Implement:

```
calculateNightRate()
calculateStayTotal()

```

---

### 3 Settings UI

Build:

```
Rate Plans CRUD
Seasonal Rules
Day-of-week Rules
Discount Codes

```

---

### 4 Rate Calendar

Create:

```
/rate-calendar

```

Add override editor and bulk actions.

---

### 5 Booking Integration

Replace flat pricing with pricing engine.

---

### 6 Booking Details

Add rate breakdown display.

---

# What This Does NOT Change

Existing bookings remain unchanged.

```
bookings.total_amount

```

is stored and never recalculated.

Also:

```
rooms.price

```

remains as a **fallback base price** for backward compatibility.

---

# Future Features (Optional)

### Length-of-Stay Discounts

```
Stay 5 nights → -10%
Stay 10 nights → -20%

```

---

### Derived Rate Plans

Example:

```
Standard = 10,000
Non-refundable = -10%
Breakfast included = +2,000

```

---

### Yield Management (Advanced)

Automatically adjust pricing based on:

```
occupancy
demand
season

```

---

# Final Result

Your system will support:

✅ Multiple rate plans  
✅ Seasonal pricing  
✅ Weekend pricing  
✅ Manual overrides  
✅ Discount codes  
✅ Occupancy pricing  
✅ Rate calendar UI  
✅ Central pricing engine
# Walk-In Booking Feature

## Current State

The system already includes:

- Guest profiles with search and history
- Booking creation wizard (`/bookings/new`)
- Front Desk page (`/front-desk`)
- Rate engine pricing

The goal is to create a **streamlined walk-in flow** allowing front desk staff to check in a guest immediately.

---

# Walk-In Mode

Walk-in mode is activated using:

/bookings/new?walkin=true

---

# Walk-In Mode Behavior

When `walkin=true` is present:

1. Page title becomes **"Walk-in Booking"**
2. Check-in date auto-set to **today**
3. Check-out date defaults to **tomorrow (1 night stay)**
4. "Check-in Immediately" toggle defaults to **ON**
5. Booking source auto-set to **direct**
6. Default rate plan = **Standard Rate**
7. Focus starts on **Guest Search/Create**

---

# Guest Creation

Guest creation should support a **quick entry form**:

Required fields:

- First name
- Last name
- Phone

Optional fields:

- Email
- Nationality
- ID number
- Notes

If phone number already exists, prompt to select the existing guest.

---

# Room Selection Rules

When in walk-in mode:

Room selection must only show rooms that are:

- available today
- not occupied
- not out_of_order
- not already reserved for the selected stay

---

# Check-In Immediately Toggle

Add a switch at the booking summary step:

"Check-in Immediately"

If enabled:

booking.status = 'checked_in'  
booking.checked_in_at = current timestamp

---

# Room Housekeeping Status

If the booking is checked in immediately:

Update assigned room:

housekeeping_status = 'occupied'

---

# Entry Points

Front Desk page should include a prominent button:

"Walk-in Guest"

Link:

/bookings/new?walkin=true

---

# After Booking Creation

If booking was created in walk-in mode:

Redirect to:

/front-desk

so the guest appears in the **In-House list immediately**.

---

# Files Modified

src/pages/NewBooking.tsx

- Walk-in mode detection
- Default stay dates
- Check-in Immediately toggle
- Room availability filtering

src/pages/FrontDesk.tsx

- Add "Walk-in Guest" button

No database changes required because the existing fields:

bookings.status  
bookings.checked_in_at

already support this flow.
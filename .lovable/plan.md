# Updated Comprehensive Role-Based Notification Plan

This plan is **mobile-first, desktop-friendly, role-aware, and future-proof**. It covers **database schema, backend, realtime updates, UI/UX, and optional enhancements**.

---

## 1️⃣ Database & Backend

### A. `notifications` Table

```
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID,
  type VARCHAR NOT NULL DEFAULT 'general',            -- booking, checkin_checkout, availability, maintenance, channel_sync, general
  category VARCHAR NOT NULL DEFAULT 'general',        -- same as type or more granular
  priority VARCHAR NOT NULL DEFAULT 'medium',        -- high, medium, low
  message TEXT NOT NULL,
  link TEXT DEFAULT NULL,                             -- optional navigation
  target_roles TEXT[] DEFAULT NULL,                  -- NULL = all staff, otherwise array of roles
  action_type TEXT DEFAULT NULL,                     -- e.g., check_in, retry_sync, view_booking
  action_entity_id UUID DEFAULT NULL,                -- relevant entity for the action
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NULL               -- for auto-archiving
);
```

### B. Role-Based Access (RLS)

```
CREATE POLICY "Staff can view notifications for their role and property"
ON notifications FOR SELECT TO authenticated
USING (
  is_staff()
  AND (
    target_roles IS NULL 
    OR target_roles && ARRAY[(SELECT role::text FROM user_roles WHERE user_id = auth.uid() LIMIT 1)]
  )
  AND (
    property_id IS NULL 
    OR EXISTS (SELECT 1 FROM user_property_access WHERE user_id = auth.uid() AND property_id = notifications.property_id)
  )
);

-- Staff can mark notifications as read
CREATE POLICY "Staff can mark notifications read" 
ON notifications FOR UPDATE TO authenticated
USING (
  is_staff() AND (
    target_roles IS NULL 
    OR target_roles && ARRAY[(SELECT role::text FROM user_roles WHERE user_id = auth.uid() LIMIT 1)]
  )
);
```

### C. Helper Edge Function

A reusable `create-notification` function for backend triggers (Booking, OTA sync, Housekeeping):

```
{
  "property_id": "uuid",
  "category": "booking",
  "priority": "high",
  "message": "John Smith - Room 203, Mar 10-15",
  "link": "/bookings/uuid",
  "target_roles": ["front_desk", "admin"],
  "action_type": "view_booking",
  "action_entity_id": "booking-uuid"
}
```

- Called by **booking-email-inbound**, **channel-sync**, housekeeping functions, etc.
- Service role key ensures **RLS-safe insertion**.

---

## 2️⃣ Roles & Role-Based Notifications


| Role                       | Relevant Notifications                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------- |
| Front Desk / Reception     | New bookings, check-ins, check-outs, cancellations, low inventory, room status updates |
| Housekeeping / Maintenance | Cleaning tasks, maintenance requests, overdue room tasks                               |
| Channel Manager / Revenue  | OTA sync errors, low inventory alerts, booking conflicts, commission updates           |
| Property Manager / Admin   | All notifications, including system alerts, settings changes, auditing                 |


**Multi-role notifications:** Include all relevant roles in `target_roles`.

---

## 3️⃣ Delivery Methods

### Desktop

- Top-right **bell icon** with unread count badge
- Dropdown shows **latest 5–10 notifications**
- Color-coded **priority dot**:
  - High = red, Medium = orange, Low = gray
- **Category icons**: Booking = calendar, Check-in/out = door, Availability = alert, Maintenance = wrench, Channel Sync = wifi
- Action buttons based on `action_type` (e.g., “Check In”, “Retry Sync”)

### Mobile (PWA)

- **BottomNav → More → Notifications**
- Full-page card list (tappable)
- Swipe gestures:
  - Left = mark as read
  - Right = perform action
- Badge on bell icon shows unread count
- Optional **push notifications via Service Worker**

---

## 4️⃣ Real-Time Updates

- **WebSocket / Supabase Realtime / Pusher**
- Push events instantly for:
  - Bookings
  - Check-in/check-out
  - Housekeeping updates
  - OTA sync errors
- Fallback: Polling every 15–30 seconds if realtime unavailable
- All notifications scoped to **property + role**

---

## 5️⃣ UI/UX Improvements

### Desktop Bell Dropdown

- Filter tabs: **All | High | Medium | Low | Booking | System**
- Shows **icon + message + timestamp**
- Click → navigate to link
- Action buttons rendered based on role

### Mobile Card Layout

- Full-page overlay on mobile
- Card includes:
  - **Icon** for category
  - **Priority color**
  - **Message**
  - **Timestamp (“5 min ago”)**
  - **Action button** (role-specific)
- Swipe gestures
- Mark individual/all as read

---

## 6️⃣ Optional Enhancements (Phase 2)

- **Daily digest/summary** for bookings, low inventory, housekeeping
- **Sound / vibration alerts** for high-priority
- **Push to external devices** (email/SMS/browser)
- **Auto-archive expired notifications** via `expires_at` cron job
- Offline caching for mobile PWA

---

## 7️⃣ Implementation Steps

1. **Backend**
  - Add new columns to `notifications`
  - Add `target_roles`, `priority`, `category`, `action_type`, `action_entity_id`, `expires_at`
  - Update RLS policies
  - Create `create-notification` edge function
2. **UI**
  - Desktop bell dropdown with filters & color-coded priority
  - Mobile full-page overlay card layout
  - Actionable buttons per role
  - Badge counts on bell icon and BottomNav
3. **Realtime**
  - Supabase Realtime / WebSocket channels
  - Fallback polling
  - Scoped to property + role
4. **Testing**
  - Simulate high-frequency notifications
  - Validate role-based filtering
  - Check actionable buttons
  - Test swipe gestures on mobile
5. **Optional / Phase 2**
  - Push notifications, digest, sound/vibration, offline caching, auto-archive

---

## 8️⃣ Files Modified / Created


| File                                              | Purpose                                                     |
| ------------------------------------------------- | ----------------------------------------------------------- |
| `src/components/layout/NotificationBell.tsx`      | Bell dropdown with filters, priority colors, action buttons |
| `src/pages/Notifications.tsx`                     | Mobile full-page card layout                                |
| `src/components/layout/BottomNav.tsx`             | Add Notifications to More menu with unread badge            |
| `supabase/functions/create-notification/index.ts` | Edge function to create notifications                       |
| `notifications table migration`                   | Add columns + RLS policies                                  |
| `src/App.tsx`                                     | Add `/notifications` route                                  |


---

✅ **Result:**

- Notifications are **role-based, actionable, and real-time**
- Supports **mobile-first UX**
- Prioritization and categorization are clear
- Desktop and PWA interfaces are clean and scannable
- Extensible for push, digest, and offline features
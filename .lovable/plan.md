
# Add Notification Bell with Dropdown

## Overview

This plan adds a functional notification bell icon to the AppHeader component that displays an unread count badge and a dropdown list of recent notifications. Staff will be able to view notifications, mark them as read, and navigate to related resources.

## Current State

- **AppHeader (`src/components/layout/AppHeader.tsx`)**: Already has a placeholder Bell icon button with a static red dot indicator
- **Notifications table**: Already exists with fields: `id`, `property_id`, `user_id`, `type`, `title`, `message`, `link`, `is_read`, `created_at`
- **Sample data**: There are unread notifications in the database from the email import system (Booking.com/Airbnb imports)
- **UI Components available**: Popover, ScrollArea, Button, Badge, Separator from shadcn/ui

## Implementation Approach

### 1. Create NotificationBell Component

**File**: `src/components/layout/NotificationBell.tsx`

A dedicated component that encapsulates all notification functionality:

**Features**:
- Fetches notifications from the database filtered by property
- Displays unread count badge (animated pulse when unread)
- Popover dropdown with scrollable notification list
- "Mark all as read" button in the header
- Individual notification items with:
  - Icon based on notification type (info, warning, success)
  - Title and message preview
  - Relative timestamp (e.g., "5 min ago")
  - Click to navigate and mark as read
- Empty state when no notifications
- Real-time updates using Supabase subscription

**Component Structure**:
```text
NotificationBell
+-- Button (trigger with Bell icon + badge)
+-- Popover
    +-- Header ("Notifications" + "Mark all read" button)
    +-- Separator
    +-- ScrollArea (max-height: 400px)
        +-- Notification items (clickable)
    +-- Footer ("View all notifications" link) [optional]
```

### 2. Update AppHeader

**File**: `src/components/layout/AppHeader.tsx`

Replace the static Bell button with the new `NotificationBell` component.

**Changes**:
- Remove the current placeholder Bell button implementation
- Import and use the new `NotificationBell` component
- Maintain the existing layout and spacing

### Technical Details

**Data Fetching**:
- Query notifications ordered by `created_at DESC` with limit of 20
- Filter by `property_id` when a specific property is selected
- Show all notifications when "All Properties" is selected

**Real-time Subscription**:
- Subscribe to `postgres_changes` on the `notifications` table
- Auto-refresh the list when new notifications arrive
- Show toast when new notification comes in (optional enhancement)

**Mark as Read Logic**:
- Individual: Update `is_read = true` when clicking a notification
- Bulk: Update all visible notifications when clicking "Mark all as read"

**Type-based Icons**:
| Type | Icon | Color |
|------|------|-------|
| `info` | Info | Blue |
| `warning` | AlertTriangle | Amber |
| `success` | CheckCircle | Green |
| `error` | XCircle | Red |
| default | Bell | Gray |

**Relative Time Display**:
- Use `formatDistanceToNow` from `date-fns` for human-readable timestamps
- Examples: "5 min ago", "2 hours ago", "yesterday"

**Responsive Design**:
- Popover width: 320px on mobile, 380px on desktop
- Notification items truncate long messages with ellipsis
- Touch-friendly tap targets (min 44px height per item)

**Files to Create**:
1. `src/components/layout/NotificationBell.tsx` - The main notification component

**Files to Modify**:
1. `src/components/layout/AppHeader.tsx` - Replace placeholder with new component

### Sample UI Design

```text
+----------------------------------+
| Notifications     [Mark all read]|
+----------------------------------+
| [!] New Airbnb Booking           |
|     Sarah Wilson - 2026-03-01... |
|     5 min ago                    |
+----------------------------------+
| [!] New Booking.com Booking      |
|     Jane Doe - 2026-02-20 to...  |
|     2 hours ago                  |
+----------------------------------+
|         No more notifications    |
+----------------------------------+
```

### Integration Points

- Uses `useProperty` hook for property filtering (same pattern as other components)
- Uses `useNavigate` from react-router-dom for navigation when clicking notifications
- Uses `supabase` client for database queries and real-time subscriptions
- Uses existing UI components (Button, Popover, ScrollArea, Badge, Separator)
- Uses `formatDistanceToNow` from date-fns for relative timestamps

### Edge Cases Handled

- No notifications: Shows empty state message
- Long notification messages: Truncated with ellipsis
- Property switching: Refetches notifications for new property
- Network errors: Shows error toast and allows retry
- All notifications read: Hides the red badge

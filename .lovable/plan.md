

# Add Availability Calendar to Dashboard

## Overview

This plan adds a compact availability calendar widget to the Dashboard page, positioned below the "Today's Activity" section and the "USD Rate" widget. The calendar will show a 7-day overview of room availability in a condensed grid format, allowing staff to quickly see upcoming availability without navigating to the full Availability Calendar page.

## Current State

- **Dashboard (`src/pages/Index.tsx`)**: Contains KPI cards, Today's Activity table, Weather widget, and USD Rate widget
- **Full Availability Calendar (`src/pages/AvailabilityCalendar.tsx`)**: Detailed room-by-room grid with week/month views
- The dashboard layout uses a 3-column grid on desktop (2 cols for activity, 1 col for widgets)

## Implementation Approach

### 1. Create Dashboard Availability Widget Component

**File**: `src/components/dashboard/DashboardAvailabilityCalendar.tsx`

Create a new compact availability calendar component that:
- Shows next 7 days horizontally
- Displays rooms vertically with status indicators
- Uses the same data fetching logic as the full calendar but simplified
- Includes a "View Full Calendar" link to `/availability`
- Fits within the dashboard's card-based design

**Key Features**:
- Compact grid: Room names (left) x 7 days (columns)
- Color-coded cells: Available (green), Reserved (amber), Occupied (red), Blocked/Maintenance (gray)
- Condensed legend at the bottom
- Loading skeleton while fetching
- Respects property filter from `useProperty` hook

### 2. Update Dashboard Layout

**File**: `src/pages/Index.tsx`

Modify the dashboard grid to include the new calendar widget:

```text
Current Layout:
+---------------------------+---------------+
| Today's Activity (2 cols) | Weather       |
|                           | USD Rate      |
+---------------------------+---------------+

New Layout:
+---------------------------+---------------+
| Today's Activity (2 cols) | Weather       |
|                           | USD Rate      |
+---------------------------+---------------+
| Availability Calendar (full width)        |
+-------------------------------------------+
```

### Technical Details

**Data Fetching Strategy**:
- Reuse the logic from `AvailabilityCalendar.tsx` but scoped to 7 days
- Fetch rooms for selected property
- Fetch bookings overlapping with the 7-day range
- Fetch room_availability blocks for the date range
- Calculate cell status (available/reserved/occupied/blocked/maintenance)

**Component Structure**:
```
DashboardAvailabilityCalendar
├── Card wrapper with title + "View All" link
├── Loading skeleton (when loading)
├── Compact grid table
│   ├── Header row with day names (Mon-Sun)
│   └── Room rows with status cells
└── Condensed legend
```

**Responsive Design**:
- On mobile: Horizontal scroll for the 7-day grid
- Smaller cell sizes (h-6 instead of h-10)
- Room names truncated with tooltip on hover

**Files to Create**:
1. `src/components/dashboard/DashboardAvailabilityCalendar.tsx` - The compact calendar widget

**Files to Modify**:
1. `src/pages/Index.tsx` - Import and add the widget below existing content

### Sample UI Preview

```text
+------------------------------------------------+
| Room Availability (7 Days)     [View Full →]   |
+------------------------------------------------+
|        | Mon | Tue | Wed | Thu | Fri | Sat | Sun |
| Room 1 |  ✓  |  R  |  R  |  R  |  ✓  |  ✓  |  ✓  |
| Room 2 |  O  |  O  |  ✓  |  ✓  |  ✓  |  R  |  R  |
| Room 3 |  ✕  |  ✕  |  ✕  |  ✓  |  ✓  |  ✓  |  ✓  |
+------------------------------------------------+
| ✓ Available  R Reserved  O Occupied  ✕ Blocked |
+------------------------------------------------+
```

### Integration with Existing Code

- Uses `useProperty` hook for property filtering (same as full calendar)
- Uses same Supabase queries pattern from `AvailabilityCalendar.tsx`
- Uses same status color scheme for consistency
- Uses existing UI components (Card, Button, Badge, cn utility)




# Comprehensive UI/UX Overhaul Plan

This plan upgrades every major page and tab with consistent visual polish, better spacing, modern layouts, and the Gantt-style availability calendar inspired by the reference image.

---

## Scope Overview

| Page | Key Changes |
|------|-------------|
| **DashboardLayout** | Tighter main padding, subtle page header redesign |
| **Dashboard (Index)** | Already polished in Phase 1 — minor refinements only |
| **Bookings** | Redesign tab strip with count badges, better search bar, card header polish |
| **New Booking** | Step-wizard style with numbered sections, better visual flow, sticky summary footer |
| **Booking Details** | Two-column layout on desktop, better info cards, cleaner timeline |
| **Front Desk** | Color-coded section headers with subtle gradients, stat card polish |
| **Rooms** | Better room cards with status dot indicators, improved grid spacing |
| **Availability Calendar** | **Gantt-style horizontal booking bars** (like reference image) replacing single-letter cells |
| **Properties** | Better property cards with cover gradient, action buttons in dropdown |
| **Reports** | Date picker polish, active quick-range highlighting |
| **Settings (all sub-tabs)** | Consistent section card styling, better form layouts, polish all 8 sub-settings |

---

## 1. Availability Calendar — Gantt-Style Redesign (Major)

Inspired by the reference image: replace single-letter grid cells with **horizontal booking bars** that span across multiple days.

**Changes to `AvailabilityCalendar.tsx`:**
- Replace the per-cell letter system (`✓`, `R`, `O`) with horizontal bars that span `[check_in, check_out)`
- Each booking renders as a colored rounded pill spanning its date columns with guest name and status badge inside
- Color scheme: Reserved = blue gradient, Occupied = green, Held = amber, Blocked = gray hatched
- Today column gets a dashed vertical highlight line (like the reference image)
- Weekend columns get a subtle diagonal stripe background pattern
- Available cells remain empty/clean
- Inventory summary cards get icon + micro-animations

**Changes to `DashboardAvailabilityCalendar.tsx`:**
- Match the same Gantt bar visual for the 7-day dashboard widget (simplified version)

---

## 2. Bookings Page Polish

**Changes to `Bookings.tsx`:**
- Tab strip: pill-shaped tabs with booking count badges (e.g., "Today (3)")
- Search bar: rounded with subtle shadow focus state
- Card wrapper: remove redundant CardHeader title per tab (tab already labels it)
- Add a subtle empty state illustration per tab

---

## 3. New Booking Form — Wizard-Style Sections

**Changes to `NewBooking.tsx`:**
- Number each card section (①  Guest, ② Stay Details, ③ Services, ④ Summary)
- Add step connector lines between sections
- Sticky bottom summary bar showing total + "Create Booking" button
- Better visual grouping of OTA pricing section with icon header
- Date pickers: show night count between check-in/out inline

---

## 4. Booking Details — Two-Column Layout

**Changes to `BookingDetails.tsx`:**
- Desktop: left column = guest info + room info + timeline, right column = transactions + services
- Mobile: stack vertically
- Info sections use icon + label pairs in a clean grid
- Status badge prominently at top with booking ID
- Action buttons grouped in a floating action bar

---

## 5. Front Desk — Section Polish

**Changes to `FrontDesk.tsx`:**
- Stat cards: add subtle gradient backgrounds matching their color
- Section cards: colored top border (3px) matching section theme
- Empty states: use matching section color icons
- Pending payments: add progress bar showing paid vs. total

---

## 6. Rooms — Card Redesign

**Changes to `Rooms.tsx`:**
- Room cards: replace left border with a top color band
- Status shown as a colored dot + label (not just badge)
- Guest name shown prominently when occupied
- Quick action buttons in a row with icon-only on mobile
- Status filter pills at top (clickable to filter)

---

## 7. Properties — Card Enhancement

**Changes to `Properties.tsx`:**
- Property cards: gradient header band with property type icon
- Active/Inactive shown as a toggle switch directly on card
- Contact info in a compact row with icons
- Action buttons in a "..." dropdown menu instead of inline

---

## 8. Reports — Date Picker & Tab Polish

**Changes to `Reports.tsx`:**
- Active quick-range button highlighted with primary color
- Tab strip matches Bookings style (pill-shaped)
- Better date range display with arrow between dates

---

## 9. Settings — All Sub-Tabs Polish

**Changes to `Settings.tsx` + all 7 settings components:**
- Settings sidebar: active item gets left accent bar + subtle bg
- All setting sections: consistent Card with icon header pattern
- **Access & Roles**: Better table styling, role badges with tooltips
- **Property (HotelSettings)**: Form fields in two-column grid with section dividers
- **Guest Settings**: Consistent with main design system
- **Services (ServicesSettings)**: Service cards in grid, not list
- **Channel Manager (ChannelsSettings)**: Channel cards with OTA icons and status indicators
- **Reports (ReportsSettings)**: Clean link card + export buttons
- **Security (DangerZoneSettings)**: Red border warning card, better confirmation flow
- **System Health**: Status indicator dots (green/amber/red) for each health check

---

## 10. Global Layout Polish

**Changes to `DashboardLayout.tsx`:**
- Main content area: consistent max-width container on ultra-wide screens
- Page transitions: subtle fade-in on route change

**Changes to `index.css`:**
- Add weekend stripe pattern CSS for availability calendar
- Add Gantt bar gradient classes
- Add step-wizard connector line styles

---

## Files to Modify

| File | Action |
|------|--------|
| `src/pages/AvailabilityCalendar.tsx` | Gantt-style redesign |
| `src/components/dashboard/DashboardAvailabilityCalendar.tsx` | Gantt bars for 7-day widget |
| `src/pages/Bookings.tsx` | Tab + search polish |
| `src/pages/NewBooking.tsx` | Wizard sections + sticky summary |
| `src/pages/BookingDetails.tsx` | Two-column layout |
| `src/pages/FrontDesk.tsx` | Section color polish |
| `src/pages/Rooms.tsx` | Card redesign |
| `src/pages/Properties.tsx` | Card enhancement |
| `src/pages/Reports.tsx` | Date picker + tab polish |
| `src/pages/Settings.tsx` | Sidebar + access roles polish |
| `src/components/settings/HotelSettings.tsx` | Form layout polish |
| `src/components/settings/ServicesSettings.tsx` | Grid layout |
| `src/components/settings/ChannelsSettings.tsx` | Channel card polish |
| `src/components/settings/ReportsSettings.tsx` | Link card polish |
| `src/components/settings/DangerZoneSettings.tsx` | Warning card polish |
| `src/components/settings/SystemHealthSettings.tsx` | Status dots |
| `src/components/settings/GuestsSettings.tsx` | Consistent styling |
| `src/components/layout/DashboardLayout.tsx` | Max-width container |
| `src/index.css` | Gantt styles, patterns, animations |
| `src/pages/Index.tsx` | Minor refinements |

This is a large scope — approximately 20 files across 10 distinct areas. Implementation will proceed in batches: Calendar Gantt redesign first (highest visual impact), then page-by-page polish.


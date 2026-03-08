

# UI/UX Enhancement Plan

This plan covers four areas: design system polish, dashboard redesign, sidebar improvements, and toast consolidation.

---

## 1. Consolidate Toast System (Sonner only)

The app currently has two toast systems: **Sonner** (used in ~35+ files) and **Radix Toast** (used only in `NotificationBell.tsx`). We will standardize on Sonner.

**Changes:**
- **`NotificationBell.tsx`** -- Replace `useToast()` calls with `toast()` from Sonner (e.g., `toast.success('All notifications marked as read')`)
- **`App.tsx`** -- Remove the Radix `<Toaster />` component, keep only `<Sonner />`
- **Delete** `src/hooks/use-toast.ts`, `src/components/ui/toaster.tsx`, `src/components/ui/use-toast.ts`, `src/components/ui/toast.tsx` (Radix toast files)

---

## 2. Design System Polish (`index.css` + shared components)

Improve typography, spacing, and visual consistency across the app.

**`index.css` additions:**
- Add a subtle body font import (Inter via Google Fonts in `index.html`) for crisper text
- Add utility classes for consistent section spacing (`.section-gap`, `.card-grid`)
- Refine focus ring styles for accessibility
- Add smooth transition defaults for interactive elements

**`Card` component (`card.tsx`):**
- Add a subtle hover elevation transition (`transition-shadow hover:shadow-md`) as a default
- Slightly soften border color for less visual noise

**`Button` component (`button.tsx`):**
- Add `transition-all duration-200` for smoother interactions
- Add a `success` variant for check-in/confirm actions (currently inline-styled)

**`Badge` component (`badge.tsx`):**
- Add `success`, `warning`, `info` variants to replace ad-hoc className overrides used across the app

---

## 3. Dashboard Redesign (`Index.tsx`)

Improve visual hierarchy and polish on the main dashboard.

**KPI Cards:**
- Add a subtle gradient or left-border accent per card color for visual distinction
- Add a micro-animation on value change (fade-in)
- Improve the icon placement with a larger, softer circular background

**Today's Activity section:**
- Add empty state illustration instead of plain text
- Improve row hover states with subtle left-border highlight
- Add a "time since" indicator for each activity

**Side Widgets (Weather + FX):**
- Redesign weather card with a gradient background and weather icon
- Add sparkline/trend arrow to the exchange rate card
- Make both widgets the same height for visual alignment

**Availability Calendar:**
- Add softer cell colors with better contrast
- Improve the legend with pill-shaped indicators

---

## 4. Sidebar Navigation Enhancement (`AppSidebar.tsx`)

**Active states:**
- Add a left accent bar (3px solid primary) on the active item instead of relying solely on background color
- Increase contrast between active and inactive states

**Hover effects:**
- Add smooth `transition-colors duration-150` on all menu items
- Add a subtle scale or translate effect on hover

**Header:**
- Add a subtle divider gradient below the logo section
- Improve the property name display with truncation tooltip

**Footer:**
- Style the user info section with an avatar placeholder (initials circle)
- Add a subtle separator above the sign-out button

**Mobile:**
- Ensure the mobile drawer has a backdrop blur overlay
- Add swipe-to-close gesture support (already handled by Radix, but verify smooth animation)

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `index.html` | Add Inter font link |
| `src/index.css` | Add typography, utility classes, transitions |
| `src/components/ui/button.tsx` | Add `success` variant, smoother transitions |
| `src/components/ui/badge.tsx` | Add `success`, `warning`, `info` variants |
| `src/components/ui/card.tsx` | Add default hover transition |
| `src/components/layout/AppSidebar.tsx` | Active bar, hover effects, user avatar |
| `src/pages/Index.tsx` | Dashboard card redesign, widget polish |
| `src/components/dashboard/DashboardAvailabilityCalendar.tsx` | Softer cell styling |
| `src/components/layout/NotificationBell.tsx` | Switch to Sonner toast |
| `src/App.tsx` | Remove Radix Toaster |
| `src/hooks/use-toast.ts` | Delete |
| `src/components/ui/toaster.tsx` | Delete |
| `src/components/ui/use-toast.ts` | Delete |
| `src/components/ui/toast.tsx` | Delete |


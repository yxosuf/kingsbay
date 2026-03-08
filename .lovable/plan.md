

## Plan: Compact Mobile Calendars

Both the **Dashboard 7-day calendar** and the **Full Availability Calendar page** need mobile optimization. The grids currently have oversized cells, wide room label columns, and bulky summary cards on small screens.

### Changes

#### 1. Dashboard Calendar (`src/components/dashboard/DashboardAvailabilityCalendar.tsx`)
- Reduce room label column from `90px` to `60px` on mobile
- Reduce cell height from `h-9` to `h-7` on mobile
- Shrink header day/date text sizes
- Reduce legend swatch sizes and text

#### 2. Full Availability Calendar (`src/pages/AvailabilityCalendar.tsx`)

**Summary cards (lines 280-301):**
- Apply same compact horizontal layout as dashboard KPI cards (icon beside text, reduced padding/font on mobile)

**Header controls (lines 235-277):**
- Stack nav buttons + date label on one row, filters on second row
- Reduce select trigger widths on mobile

**Grid (lines 322-407):**
- Reduce room label column from `120px` to `70px` on mobile
- Reduce cell height from `h-11` to `h-8` on mobile
- Reduce `minmax` from `80px`/`36px` to `44px`/`28px` on mobile (using `useIsMobile`)
- Smaller room label font size on mobile

**Legend (lines 411-428):**
- Shrink legend swatches and gaps on mobile

### Files Modified
- `src/components/dashboard/DashboardAvailabilityCalendar.tsx`
- `src/pages/AvailabilityCalendar.tsx`


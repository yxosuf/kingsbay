

## Plan: Full-Page Settings Layout (No Main Sidebar)

### What's Changing
Instead of fixing the scroll issue with sticky positioning, the Settings page will render **without the main sidebar entirely** — giving it a dedicated full-width layout with its own back navigation.

### Approach

#### 1. Settings.tsx — Remove `DashboardLayout` wrapper
- Replace `<DashboardLayout>` with a standalone full-page layout
- Add a compact header with a **back button** (arrow left icon) that navigates to `/` and expands the main sidebar back
- The settings sidebar nav + content area fill the full viewport width
- The settings sidebar becomes fixed-height (`h-screen`) with internal scroll, eliminating the sticky scroll bug entirely

#### 2. Settings.tsx — Layout Structure
```text
┌──────────────────────────────────────────────────┐
│ ← Back   Settings                    (header)    │
├─────────────┬────────────────────────────────────┤
│ Nav sidebar │                                    │
│ (fixed h)   │  Content area (scrollable)         │
│             │                                    │
│ Access      │                                    │
│ Property    │                                    │
│ Guests      │                                    │
│ ...         │                                    │
└─────────────┴────────────────────────────────────┘
```

- On mobile: horizontal tab bar at top (existing behavior preserved)
- The nav sidebar uses `h-[calc(100vh-4rem)]` with `overflow-y-auto` — no sticky needed
- Content area also scrolls independently

#### 3. AppSidebar.tsx — No changes needed
The existing `handleSettingsClick` already collapses the sidebar. This plan makes Settings fully independent of the sidebar, so even if the sidebar is collapsed/expanded, Settings works standalone.

### Files Modified
- `src/pages/Settings.tsx` — Replace `DashboardLayout` with standalone full-page layout, add back-navigation header


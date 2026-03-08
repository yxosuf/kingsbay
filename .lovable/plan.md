

## Plan: Sidebar User Popover, Settings Auto-Collapse, and Settings Scroll Fix

### Problem Summary
1. **User avatar in sidebar** — currently shows name/role inline with a separate sign-out button. User wants a clickable avatar that opens a popover with Settings + Sign Out actions.
2. **Settings navigation** — clicking Settings should auto-collapse the main sidebar to give more room.
3. **Settings scroll bug** — the settings sidebar tabs scroll with the page content instead of staying fixed.

---

### Changes

#### 1. AppSidebar.tsx — User Popover
- Remove the inline user info display and standalone Sign Out button from the footer.
- Make the user avatar clickable, opening a `Popover` (from Radix) with:
  - User name + role display at top
  - A "Settings" button that navigates to `/settings`
  - A "Sign Out" button
- Works in both expanded and collapsed sidebar states (avatar is always visible).
- When clicking "Settings" from the popover, also call `toggleSidebar()` to collapse the sidebar.

#### 2. AppSidebar.tsx — Settings Collapses Sidebar
- Import `toggleSidebar` from `useSidebar()`.
- When the Settings nav item is clicked, call `toggleSidebar()` to collapse the main sidebar before navigating to `/settings`.
- This gives the Settings page more horizontal space for its own internal sidebar.

#### 3. Settings.tsx — Fix Scroll Bug
- The desktop settings sidebar card uses `sticky top-4` but the parent container doesn't constrain its height properly.
- Fix: Add `items-start` to the parent flex container so the sticky sidebar doesn't stretch to full content height.
- Ensure the settings sidebar card has `max-h-[calc(100vh-8rem)] overflow-y-auto` for cases where there are many nav items.

---

### Files Modified
- `src/components/layout/AppSidebar.tsx` — User popover + settings collapse logic
- `src/pages/Settings.tsx` — Fix sticky scroll on desktop sidebar


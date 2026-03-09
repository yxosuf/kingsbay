

# Hover Auto-Expand Sidebar with Visual Redesign

## Analysis

The reference image shows a **minimal icon-only sidebar** with:
- Rounded blue circular icon buttons (two at top, one at bottom)
- Icons centered vertically
- Light background color (#F5F5F5-ish)
- Very clean, modern design
- Very narrow width (~48-60px)

Current sidebar uses:
- `collapsible="icon"` mode with `SIDEBAR_WIDTH_ICON = "3rem"` (48px)
- Dark brown theme from King's Bay branding
- Manual toggle via button/keyboard shortcut
- Already supports collapsed/expanded states with transitions

## Implementation Plan

### 1. **AppSidebar.tsx** - Add Hover Logic
- Add `isHovered` state and `hoverTimeoutRef`
- Add `onMouseEnter`/`onMouseLeave` handlers to root `<Sidebar>` element
- Use `useEffect` to call `setOpen(isHovered)` when hover state changes
- Add 100ms delay on mouse leave to prevent flickering
- Keep existing navigation structure intact

### 2. **DashboardLayout.tsx** - Default to Collapsed
- Change `SidebarProvider` to `defaultOpen={false}`
- Sidebar will start collapsed and expand only on hover

### 3. **Visual Refinements** (Optional Enhancements)
The current sidebar already has circular icons when collapsed. To match the reference image more closely:
- Icons are already centered in collapsed mode via existing CSS
- Active state already has visual indicators
- The brown theme matches the King's Bay branding, no need to change to blue unless user requests

## Key Behavior

**Desktop:**
- Sidebar starts collapsed (icon-only, 48px wide)
- Hover → expands to full width (256px) instantly
- Mouse leave → collapses after 100ms delay
- Smooth 200ms CSS transition (already built-in)

**Mobile:**
- No changes - continues using Sheet/drawer behavior
- Hover logic disabled on mobile

## Files Modified
1. `src/components/layout/AppSidebar.tsx` - hover state + event handlers
2. `src/components/layout/DashboardLayout.tsx` - defaultOpen={false}


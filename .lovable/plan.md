

## Make Sidebar Floating with Larger Expanded Text

### Problem
The current sidebar is docked (`variant="sidebar"`) and pushes content. The expand-on-hover experience feels rigid. Text size when expanded is small (text-sm).

### Changes

**1. `src/components/layout/AppSidebar.tsx`**
- Change `<Sidebar>` to use `variant="floating"` -- this adds rounded corners, shadow, padding, and makes it overlay content instead of pushing it
- Remove `border-r border-sidebar-border` class (floating variant handles its own border)
- Increase nav text size when expanded: change icon size to `h-5 w-5` and add `text-base` to the span labels
- Increase header property name font size when expanded

**2. `src/components/ui/sidebar.tsx`**
- Update `sidebarMenuButtonVariants` default size from `h-8 text-sm` to `h-10 text-base` so expanded buttons are larger and more readable
- The floating variant is already built into the Sidebar component (rounded-lg, border, shadow) -- no structural changes needed there

### How the floating variant works (already in code)
The Sidebar component at line 188-189 already handles `variant="floating"`:
- Adds `p-2` padding around the sidebar panel
- Gap spacer uses `w-[calc(var(--sidebar-width-icon) + spacing.4)]` when collapsed
- Inner div gets `rounded-lg border shadow` styling

### Result
- Sidebar floats over content with rounded corners and shadow
- On hover-expand, nav items display with larger `text-base` labels
- Icons slightly larger for better visual weight
- Content underneath is not pushed -- sidebar overlays it


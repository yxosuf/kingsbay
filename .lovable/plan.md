

# Hover-Based Auto-Expand Sidebar Implementation Plan

## Current State Analysis

The sidebar currently uses manual toggle behavior via:
- `SidebarTrigger` button in header
- Keyboard shortcut (Cmd/Ctrl + B)
- Click-based collapse/expand

The reference image shows:
- **Vertical icon-only sidebar** with circular icon buttons
- **Clean, minimal design** with soft blue accent colors
- **Icons stacked vertically**: Dashboard, settings, users, etc.
- **User avatar at bottom**
- **Consistent spacing and sizing**

## Design Goals

1. **Auto-expand on hover**: Sidebar expands when mouse enters, collapses when mouse leaves
2. **Match visual style**: Circular icon buttons, vertical layout, clean spacing
3. **Smooth transitions**: 200-300ms animation for expand/collapse
4. **Preserve functionality**: Keep existing navigation, active states, tooltips

## Technical Implementation

### 1. Sidebar Hover Logic (`AppSidebar.tsx`)

**Add hover state management:**
```typescript
const [isHovered, setIsHovered] = useState(false);
const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
```

**Override sidebar state based on hover:**
```typescript
// Use hover state to control expansion
useEffect(() => {
  if (!isMobile && isHovered) {
    setOpen(true);
  } else if (!isMobile && !isHovered) {
    setOpen(false);
  }
}, [isHovered, isMobile, setOpen]);
```

**Add mouse event handlers:**
```typescript
const handleMouseEnter = () => {
  if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
  setIsHovered(true);
};

const handleMouseLeave = () => {
  hoverTimeoutRef.current = setTimeout(() => {
    setIsHovered(false);
  }, 100); // Small delay to prevent flickering
};
```

### 2. Visual Redesign Matching Reference Image

**Header Changes:**
- Remove property name text in collapsed state
- Make logo circular and centered
- Reduce header padding

**Navigation Items:**
- Convert to circular icon buttons when collapsed
- Add blue accent color on active (matching reference)
- Increase icon size slightly for better visibility
- Center icons in collapsed state

**Footer:**
- Show only avatar circle when collapsed
- Expand to show full user info on hover

**Color Adjustments:**
- Update active state to use soft blue accent (`--sidebar-ring` or custom blue)
- Lighter background for cleaner look
- More subtle hover states

### 3. Sidebar Component Updates (`sidebar.tsx`)

**No changes needed** - the existing `Sidebar` component already supports:
- Controlled `open` state
- Smooth transitions via CSS
- Icon-only collapsed mode

### 4. Layout Integration (`DashboardLayout.tsx`)

**Default sidebar to collapsed:**
```typescript
<SidebarProvider defaultOpen={false}>
```

This ensures sidebar starts collapsed and expands only on hover.

## Files to Modify

1. **`src/components/layout/AppSidebar.tsx`**
   - Add hover state and event handlers
   - Apply hover logic to control sidebar expansion
   - Adjust visual styling to match reference image
   - Update icon sizes and spacing

2. **`src/components/layout/DashboardLayout.tsx`**
   - Set `defaultOpen={false}` on `SidebarProvider`

3. **`src/index.css`** (optional)
   - Add custom blue accent color variable if needed
   - Fine-tune transition timings

## Interaction Flow

1. **Page loads**: Sidebar collapsed (icon-only, ~48px width)
2. **User hovers**: Sidebar smoothly expands to full width (~256px) after 0ms
3. **User moves away**: After 100ms delay, sidebar collapses back
4. **Active route**: Always highlighted with blue accent, visible in both states
5. **Mobile**: Unchanged - continues using sheet/drawer behavior

## Expected Visual Result

- **Collapsed state**: Vertical strip of circular icons (dashboard, front desk, bookings, etc.)
- **Expanded state**: Full sidebar with text labels and details
- **Transition**: Smooth 200ms ease animation
- **Active indicator**: Blue circular background or left border accent
- **User section**: Avatar circle at bottom, expands to show name/role on hover


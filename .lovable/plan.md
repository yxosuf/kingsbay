

## Plan: Compact Mobile Dashboard Cards

### Problem
The KPI cards on mobile are too tall — they stack the icon below the text vertically and have generous padding, making them oversized for a phone screen.

### Changes

**`src/pages/Index.tsx`** — KPI stat cards section (lines ~344-377):
- Change mobile layout from vertical stack to **horizontal row** (icon beside text) on all screen sizes
- Reduce mobile padding from `p-4` to `p-3`
- Make icon container smaller on mobile (`p-1.5` instead of `p-2.5`)
- Reduce icon size on mobile (`h-4 w-4`)
- Reduce value font size on mobile from `text-xl` to `text-lg`
- Keep `flex-col` only removed — always use `flex-row items-center justify-between`

**Result layout per card on mobile:**
```text
┌──────────────────┐
│ Active Guests [👤]│
│ 1                │
└──────────────────┘
```

Instead of the current tall layout:
```text
┌──────────────────┐
│ Active Guests    │
│ 1                │
│                  │
│ [👤]             │
└──────────────────┘
```

### Files Modified
- `src/pages/Index.tsx` — KPI cards grid and card content layout only

No other files affected. Desktop layout stays the same.


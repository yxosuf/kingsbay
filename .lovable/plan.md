
## Apply Gradient KPI Card Style Across All Stat Cards

### What the reference style does
The reference CSS creates a **gradient-border glow** effect:
- Outer wrapper has a gradient background (acts as a visible border/frame)
- Inner card fills almost the full space, creating a 2px gradient border
- On hover: inner card scales down to 0.98x + outer wrapper gets a glow shadow

### Color adaptation (brand-appropriate)
Since the project uses a warm hospitality theme (brown/amber), the neon green/purple of the reference will be adapted per card type:

```text
primary  → gradient #5C2D00 → #A0540A  |  glow rgba(92, 45, 0, 0.35)
success  → gradient #00875A → #00C87A  |  glow rgba(0, 135, 90, 0.35)
warning  → gradient #B37400 → #E89000  |  glow rgba(255, 171, 0, 0.35)
info     → gradient #0060B0 → #2B90D9  |  glow rgba(0, 96, 176, 0.35)
destructive → gradient #B02020 → #E53C3C | glow rgba(176, 32, 32, 0.35)
```

### Files to create/modify

**1. Create `src/components/ui/KpiCard.tsx`**
New reusable component with:
- `colorVariant`: primary | success | warning | info | destructive
- Outer gradient wrapper div (p-[2px] creates the border effect)
- Inner `bg-card` div with `group-hover:scale-[0.98]` transition
- Dynamic inline style for the hover glow shadow using `onMouseEnter/Leave`
- Props: `icon`, `label`, `value`, `subtitle?`, `onClick?`

**2. Update `src/components/front-desk/StatCard.tsx`**
Replace the plain Card with the new KpiCard component. Map `color` prop to `colorVariant`.

**3. Update `src/pages/Index.tsx`** (Dashboard KPI section, lines 281–314)
Replace the 4 `Card` stat items with `KpiCard`, mapping each card's `borderColor` to the matching `colorVariant`.

**4. Update `src/components/reports/RevenueReport.tsx`** (lines 221–285)
Wrap each of the 4 KPI cards with the gradient border style.

**5. Update `src/components/reports/OccupancyReport.tsx`** (lines 213–270)
Same treatment for the 4 occupancy KPI cards.

**6. Update `src/components/reports/FinancialSummary.tsx`** (lines 265–330)
Same treatment for the 4 financial KPI cards.

**7. Update `src/components/reports/FeedbackReport.tsx`** (lines 202–247)
Same treatment for the 4 feedback KPI cards.

**8. Update `src/components/settings/ChannelsSettings.tsx`** (lines 372–395)
Replace the 4 channel stat cards with `KpiCard`.

### Component structure

```text
<div  ← outer gradient wrapper (group, p-[2px], rounded-2xl, gradient bg)
  style={{ backgroundImage: gradient, boxShadow: (on hover) glow }}
>
  <div  ← inner card (bg-card, rounded-2xl, group-hover:scale-[0.98])
  >
    [icon + label + value + subtitle]
  </div>
</div>
```

### Technical notes
- Icon background color removed (gradient border provides the visual accent)
- The `group` Tailwind class on outer div + `group-hover:scale-[0.98]` on inner handles the scale effect without JS state
- Hover glow shadow requires `onMouseEnter/Leave` with inline style since it's per-card color
- All existing click handlers, routing, and data remain unchanged
- Responsive: existing `grid-cols-2 lg:grid-cols-4` grid unchanged

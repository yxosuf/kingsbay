

## Plan: Compact Mobile Channel Manager UI

### Changes

#### 1. `src/pages/ChannelManager.tsx` — KPI cards & layout
- **KPI cards**: Apply the same compact horizontal layout used on dashboard — `p-3 sm:p-6`, smaller icons (`h-4 w-4`), reduced value font (`text-lg sm:text-2xl`), subtitle `text-[10px] sm:text-xs`
- **Grid**: Change to `grid-cols-2 md:grid-cols-4` so 4 KPI cards show as 2×2 on mobile
- **Sync button**: Make it `size="sm"` on mobile
- **Tab triggers**: Reduce icon/text size on mobile, hide icon labels below sm
- **Add Channel cards**: Reduce padding to `p-3` on mobile, smaller icon size

#### 2. `src/components/channels/ChannelCard.tsx` — Channel connection cards
- Reduce `CardHeader` padding to `p-3 sm:p-6 pb-1 sm:pb-2`
- Reduce `CardContent` padding to `p-3 sm:p-6 pt-1 sm:pt-0`
- Shrink channel icon to `size="sm"` on mobile
- Reduce `CardTitle` to `text-sm`
- Make action buttons smaller (`h-8 text-xs`) on mobile
- Tighten internal spacing (`space-y-2 sm:space-y-3`)

#### 3. `src/components/channels/SyncStatus.tsx` — Sync logs summary cards
- Apply compact horizontal layout to the 3 summary stat cards (Successful/Failed/Total Records)
- Reduce padding and font sizes on mobile
- Make table cells more compact with smaller text

### Files Modified
- `src/pages/ChannelManager.tsx`
- `src/components/channels/ChannelCard.tsx`
- `src/components/channels/SyncStatus.tsx`


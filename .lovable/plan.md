

## Problem

The calendar uses a fixed `colWidth` of 80px per day in week view. In week mode that's only 7 × 80 = 560px of content plus the 120px room column = 680px total. On a full-screen display (1400px+), this leaves a large empty gap on the right.

## Solution

Make columns fluid — they should stretch to fill the available container width instead of using a fixed pixel width.

### Changes

**`src/pages/AvailabilityCalendar.tsx`**

1. **Remove fixed `colWidth`** — replace the pixel-based layout with CSS flex/grid that fills the container.
2. **Switch from absolute-positioned Gantt bars to a hybrid approach**:
   - Use `flex-1` on each date column so they distribute evenly across the full width.
   - For Gantt booking bars, calculate positions using percentages or use a ref to measure actual column width at render time.
3. **Approach**: Use a container ref + `ResizeObserver` to compute actual `colWidth` dynamically:
   ```
   const containerRef = useRef()
   const [computedColWidth, setComputedColWidth] = useState(80)

   useEffect(() => {
     const observer = new ResizeObserver(entries => {
       const containerWidth = entries[0].contentRect.width - 120 // minus room label
       setComputedColWidth(Math.max(36, containerWidth / dateRange.length))
     })
     observer.observe(containerRef.current)
     return () => observer.disconnect()
   }, [dateRange.length])
   ```
4. Remove the `minWidth` style on the inner div — let it naturally fill the container width. Keep `overflow-x-auto` as a fallback for month view on small screens.
5. Use `computedColWidth` everywhere `colWidth` was used — all Gantt bar position/width calculations, column widths, and conditional text visibility checks.

**`src/components/dashboard/DashboardAvailabilityCalendar.tsx`**
- Apply the same dynamic column width approach for consistency.

### Result
- Week view: 7 columns stretch to fill the full screen width — no empty space.
- Month view: 28-31 columns still use the container width; if too narrow, horizontal scroll kicks in naturally.
- All Gantt bar positioning remains accurate since it's computed from actual measured column width.


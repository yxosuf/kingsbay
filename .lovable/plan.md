

# Performance Optimization Plan: Fix Slow Button Interactions

## Problem Analysis

Based on the codebase review and console logs, I've identified several performance bottlenecks causing slow button interactions:

### Root Causes

1. **Excessive Re-renders in NewBooking.tsx** (1,150 lines)
   - Multiple `useEffect` hooks triggering on every state change
   - Heavy calculations running synchronously on every input change
   - Availability checks and rate calculations blocking UI
   - Large form with 20+ state variables causing cascading re-renders

2. **Missing Memoization**
   - `ServiceSelector` component re-renders on every parent update
   - Service calculations running on every interaction
   - Filtered room lists recalculated unnecessarily

3. **Synchronous Database Queries**
   - Room availability checks blocking form interactions
   - Guest search hitting database on every keystroke
   - Booked dates fetched for 6-month range on mount

4. **React Ref Warnings**
   - `Select` and `ServiceSelector` components receiving refs incorrectly
   - Causing React to re-validate component tree

## Technical Solution

### 1. Add React.memo to Heavy Components

**Target Files:**
- `src/components/booking/ServiceSelector.tsx`
- Form sections in `NewBooking.tsx`

**Changes:**
- Wrap `ServiceSelector` in `React.memo` with custom comparison
- Memoize service list rendering
- Prevent re-renders when parent form state changes

### 2. Debounce and Optimize Database Queries

**NewBooking.tsx optimizations:**
- Add debouncing to guest search (300ms delay)
- Memoize room filtering logic with `useMemo`
- Batch availability checks
- Use `useCallback` for event handlers to prevent recreation

### 3. Defer Non-Critical Calculations

**Rate calculations:**
- Move rate engine calculations to web worker or async
- Show loading state instead of blocking UI
- Calculate only when check-in/check-out finalized

**Booked dates:**
- Lazy load only visible month range
- Load on calendar open, not page mount

### 4. Fix React Ref Warnings

**ServiceSelector.tsx:**
- Use `React.forwardRef` wrapper
- Pass ref correctly to underlying elements

**NewBooking.tsx:**
- Remove ref from `Select` components or wrap properly

### 5. Optimize State Updates

**Batch related updates:**
```typescript
// Instead of multiple setState calls
setCheckIn(date);
setCheckOut(endDate);
recalculateRate();

// Use single update
React.startTransition(() => {
  setCheckIn(date);
  setCheckOut(endDate);
});
```

**Use React 18 concurrent features:**
- Wrap heavy updates in `startTransition`
- Mark non-urgent state as deferred

## Implementation Strategy

### Phase 1: Quick Wins (Immediate Impact)
1. Memoize `ServiceSelector` component
2. Debounce guest search input
3. Add `useCallback` to form handlers
4. Fix ref warnings

### Phase 2: Deep Optimization
1. Refactor rate calculation to async
2. Implement virtual scrolling for service list
3. Lazy load booked dates
4. Split NewBooking form into sub-components

### Phase 3: Architecture
1. Consider form library (React Hook Form) for better performance
2. Move validation to schema-based approach
3. Implement optimistic UI updates

## Expected Results

- **Button click response**: < 50ms (from current ~300-500ms)
- **Form input typing**: No lag (currently noticeable delay)
- **Tab switching**: Instant (currently 200-300ms)
- **Service selection**: Immediate feedback

## Files to Modify

1. `src/components/booking/ServiceSelector.tsx` - Add memo, callbacks
2. `src/pages/NewBooking.tsx` - Debounce, memoization, optimization
3. `src/lib/availabilityCheck.ts` - Make async-friendly
4. `src/lib/rateEngine.ts` - Add throttling option

## Testing Checklist

- [ ] Verify tab switching is instant
- [ ] Test button clicks respond < 50ms
- [ ] Confirm service selection shows immediate feedback
- [ ] Check no console warnings remain
- [ ] Test on slower devices/network
- [ ] Verify all calculations still accurate
- [ ] Ensure form validation still works


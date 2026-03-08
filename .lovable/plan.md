

## Plan: Align Dashboard Calendar Date Handling and Add Date Tooltip

### Problem
The dashboard calendar and availability calendar could potentially show bars at shifted positions due to:
1. The dashboard uses `format(date, 'yyyy-MM-dd')` for query dates instead of the timezone-safe `toDateString()` helper
2. The dashboard tooltip doesn't show check-in/check-out dates, making it hard to verify correctness
3. The two calendars show different date ranges (dashboard: today+7, availability: week view), which makes bars appear at different column positions

### Changes

**`src/components/dashboard/DashboardAvailabilityCalendar.tsx`**

1. **Replace `format()` with `toDateString()`** for query date strings (lines 75-76):
   ```typescript
   // Before
   const startDate = format(dateRange[0], 'yyyy-MM-dd');
   const endDate = format(dateRange[dateRange.length - 1], 'yyyy-MM-dd');
   // After
   const startDate = toDateString(dateRange[0]);
   const endDate = toDateString(dateRange[dateRange.length - 1]);
   ```
   This ensures consistent timezone-safe date string generation matching the availability calendar.

2. **Add check-in/check-out dates to booking bar tooltip** so users can verify the dates are correct:
   ```typescript
   <TooltipContent>
     <p className="font-medium">{booking.guest?.name || 'Guest'}</p>
     <p className="text-xs text-muted-foreground">
       {booking.check_in} → {booking.check_out} · {barType}
     </p>
   </TooltipContent>
   ```

These are small targeted changes — no structural or logic changes needed since both calendars already use the same `getDateIndex` and bar width calculations.


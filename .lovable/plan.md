

# Performance Optimization Plan

## Key Bottlenecks Identified

1. **No code splitting** — All 20+ pages are bundled together and loaded upfront via static imports in `App.tsx`. Every route loads even if the user only visits the dashboard.

2. **No React Query usage for data fetching** — Pages like Dashboard, Bookings, Availability Calendar, and Rate Calendar all use raw `useState`/`useEffect` with manual `supabase` calls. This means zero caching, no background refetching, and full re-fetches on every navigation.

3. **QueryClient has no staleTime** — The existing `QueryClient` instance has default config (staleTime: 0), so even the few places using React Query refetch constantly.

4. **Auth fetches role + profile sequentially** — `fetchUserData` in `useAuth.tsx` calls `user_roles` then `profiles` one after the other instead of `Promise.all`.

5. **Search inputs lack debounce** — Bookings page search triggers filter on every keystroke.

6. **Dashboard fires 7 parallel queries on every property switch** — No caching, so switching properties or navigating away and back always re-fetches everything.

## Implementation Plan

### 1. Add Route-Level Code Splitting (`App.tsx`)
- Replace all static page imports with `React.lazy()` + `Suspense`
- Group a shared loading spinner fallback
- This reduces initial bundle size significantly since most users land on Dashboard

### 2. Configure QueryClient with Global Defaults (`App.tsx`)
- Set `staleTime: 5 * 60 * 1000` (5 min) and `gcTime: 10 * 60 * 1000`
- This means navigating between pages reuses cached data instantly

### 3. Parallelize Auth Data Fetching (`useAuth.tsx`)
- Change `fetchUserData` to use `Promise.all([roleQuery, profileQuery])` instead of sequential awaits

### 4. Convert Dashboard to React Query (`Index.tsx`)
- Replace the manual `fetchDashboardData` with `useQuery` keyed on `['dashboard', propertyId]`
- Data stays cached when navigating away and back
- Background refetch keeps it fresh

### 5. Convert Bookings to React Query (`Bookings.tsx`)
- Replace manual fetch with `useQuery` keyed on `['bookings', propertyId, activeTab]`
- Add 300ms debounce to search input

### 6. Convert Rate Calendar to React Query (`RateCalendar.tsx`)
- Cache rate data, overrides, and room types with `useQuery`
- Keyed on `['rateCalendar', propertyId, selectedRoomType, monthKey]`

### 7. Memoize Heavy Child Components
- Wrap `BookingTable`, `HealthCategorySection`, and calendar grid renders with `React.memo`
- Add `useMemo` for filtered/computed lists that re-derive on every render

## Files Modified

| File | Change |
|------|--------|
| `src/App.tsx` | Lazy imports + Suspense + QueryClient config |
| `src/hooks/useAuth.tsx` | Parallelize role + profile fetch |
| `src/pages/Index.tsx` | Convert to useQuery |
| `src/pages/Bookings.tsx` | Convert to useQuery + debounced search |
| `src/pages/RateCalendar.tsx` | Convert to useQuery |
| `src/components/booking/BookingTable.tsx` | React.memo wrapper |
| `src/components/settings/health/HealthCategorySection.tsx` | React.memo wrapper |

No database changes needed.


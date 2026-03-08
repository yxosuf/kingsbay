

## Plan: Add Housekeeping & Rate Calendar to Sidebar Toggle Options

**File:** `src/components/settings/OtherSettings.tsx`

Add two entries to the `TOGGLEABLE_PAGES` array:

```ts
{ url: '/housekeeping', label: 'Housekeeping' },
{ url: '/rate-calendar', label: 'Rate Calendar' },
```

Also add Rate Calendar to `LANDING_PAGE_OPTIONS`:

```ts
{ value: '/rate-calendar', label: 'Rate Calendar' },
```

Single file, ~4 lines added. No other changes needed — the sidebar (`AppSidebar.tsx`) already filters items via `userSettings.hidden_pages`.




## Code Audit Results -- Bugs & Issues Found

### Critical Issues

**1. BottomNav: Hidden pages not respected in primary tabs**
`src/components/layout/BottomNav.tsx` line 72-106: The `primaryTabs` array includes `/availability` which is a toggleable/hideable page, but only `moreMenuItems` is filtered by `userSettings.hidden_pages`. If a user hides "Availability" in Other Settings, it still shows in the bottom nav primary tabs on mobile.

**Fix**: Filter `primaryTabs` the same way, excluding hidden pages (but never hide Dashboard, Bookings, New Booking).

**2. Notifications page: `handleDeleteAll` ignores property filter (multi-property violation)**
`src/pages/Notifications.tsx` line 410-416: Deletes ALL notifications across ALL properties regardless of selected property. This violates the multi-property isolation rule.

**Fix**: Add property filter when a specific property is selected:
```ts
let query = supabase.from('notifications').delete();
if (selectedProperty && !showAllProperties) {
  query = query.eq('property_id', selectedProperty.id);
} else {
  query = query.neq('id', '00000000-...');
}
```

### Minor Issues (Type Safety / Code Quality)

**3. Remaining `as any` casts in 3 files**
Now that `notification_preferences` and `user_settings` tables exist in the generated types:
- `useNotificationPreferences.ts` line 68: `payload as any` on upsert -- unnecessary
- `NotificationSettings.tsx` line 132: `as any` on priority_threshold cast -- should be `as NotificationPreferences['priority_threshold']`
- `useUserSettings.tsx` line 80: `hidden_pages: merged.hidden_pages as any` -- unnecessary, Json type accepts arrays

**4. `useUserSettings` stale closure in `saveSettings`**
`src/hooks/useUserSettings.tsx` line 66-90: `saveSettings` has `settings` in its dependency array, but also calls `setSettings(merged)` optimistically. If two rapid saves happen, the second could use stale `settings` from the first closure. 

**Fix**: Use functional state update pattern or useRef for latest settings.

### Verified Working (No Issues Found)

- Notification preferences table schema and RLS policies -- correct
- Notifications table `image_url` and `actions` columns -- present in types
- Realtime subscriptions in NotificationBell and Notifications page -- correct channel setup
- Digest filtering logic using `shouldShowNotification` -- correct
- Role-based action permissions (ACTION_ROLE_MAP) -- correct
- Swipeable cards touch handling -- correct
- Rich notification rendering (image_url, actions array) -- correct
- Push notification permission flow -- correct
- Settings tab routing with `?tab=notifications` -- correct
- AppSidebar hidden_pages filtering -- correct
- OtherSettings toggle/theme/landing page logic -- correct
- useAuth role system -- correct, uses server-side RLS
- Date logic not affected by these changes

### Summary of Changes

| File | Issue | Severity |
|------|-------|----------|
| `BottomNav.tsx` | Primary tabs ignore hidden_pages | Medium |
| `Notifications.tsx` | Delete all ignores property filter | Critical |
| `useNotificationPreferences.ts` | Unnecessary `as any` | Low |
| `NotificationSettings.tsx` | Unnecessary `as any` | Low |
| `useUserSettings.tsx` | Stale closure + `as any` | Low |

Total: 5 files need fixes, 2 functional bugs + 3 type cleanup items.


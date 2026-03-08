

## Plan: Fix Phase 3 Notification System -- Missing Migration & Pending Items

### Problem
The previous Phase 3 implementation created frontend code but the database migration was never applied. Two critical schema changes are missing:

1. **`notification_preferences` table does not exist** -- the `NotificationSettings` component and `useNotificationPreferences` hook query a non-existent table (silently failing, falling back to defaults)
2. **`notifications` table is missing `image_url` and `actions` columns** -- rich notification features have no backing schema

Realtime is already enabled for the `notifications` table (confirmed). The `user_settings` table exists and works.

### Changes Required

#### 1. Database Migration (Critical)
Create and apply a single migration that:
- Creates `notification_preferences` table with `user_id` (unique, references `auth.users`), `categories` (JSONB), `priority_threshold` (TEXT), `delivery_channels` (JSONB), timestamps
- Enables RLS with policies: users can SELECT/INSERT/UPDATE their own row
- Adds `image_url` (TEXT) and `actions` (JSONB) columns to `notifications` table

```sql
CREATE TABLE public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  categories JSONB NOT NULL DEFAULT '{"booking":true,"checkin_checkout":true,"availability":true,"maintenance":true,"channel_sync":true,"general":true}',
  priority_threshold TEXT NOT NULL DEFAULT 'low',
  delivery_channels JSONB NOT NULL DEFAULT '{"in_app":true,"push":true}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
-- 3 RLS policies: SELECT, INSERT, UPDATE for own user_id

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS actions JSONB;
```

#### 2. Fix `useNotificationPreferences` hook
Remove `as any` type casts now that the table exists in the schema. The hook logic is correct but currently silently fails because the table doesn't exist.

#### 3. Fix `NotificationSettings` component
Remove `as any` casts. No functional changes needed -- the UI is already built correctly.

#### 4. No other changes needed
- Realtime channels are already subscribed and working (confirmed `notifications` is in `supabase_realtime` publication)
- Digest filtering logic is implemented correctly in both `NotificationBell` and `Notifications` page
- Role-based action permissions (`ACTION_ROLE_MAP`) are implemented
- Swipeable cards on mobile are implemented
- Push notification logic with permission states is implemented
- Mark all read / Delete all functionality is implemented
- Gear icon in bell dropdown links to `/settings?tab=notifications`

### Summary
This is primarily a **database fix** -- creating the missing table and columns. The frontend code is already complete and will start working once the schema exists.


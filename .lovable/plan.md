

## Plan: Add "Other Settings" Tab

### Overview
Add a new "Other Settings" tab to the Settings page with three sections:
1. **Hide/Show Sidebar Pages** -- checkboxes to toggle visibility of sidebar nav items (Front Desk, Availability, Channel Manager, etc.)
2. **Default Landing Page** -- dropdown to select which page loads after login
3. **Theme / Appearance** -- dark mode toggle (using next-themes already installed)

### Storage
Create a `user_settings` table to persist per-user preferences (hidden pages, default landing page, theme). This follows the same pattern as `notification_preferences`.

### Database Migration
```sql
CREATE TABLE public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  hidden_pages JSONB NOT NULL DEFAULT '[]'::jsonb,
  default_landing_page TEXT NOT NULL DEFAULT '/',
  theme TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings" ON public.user_settings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert own settings" ON public.user_settings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings" ON public.user_settings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
```

### New Files
- **`src/hooks/useUserSettings.ts`** -- Hook to fetch/save user settings from `user_settings` table. Provides `settings`, `loading`, `saveSettings()`. Also exposes a context provider so sidebar/bottom nav can read `hidden_pages`.
- **`src/components/settings/OtherSettings.tsx`** -- Settings UI with three cards:
  - **Page Visibility**: Checkboxes for each toggleable page (Front Desk, Availability, Channel Manager, Room Status). Dashboard and Bookings are always visible.
  - **Default Landing Page**: Select dropdown with available pages.
  - **Theme**: Radio group or select for Light / Dark / System.

### Modified Files
1. **`src/pages/Settings.tsx`**
   - Add `'other'` to `SettingsSection` type
   - Add nav item: `{ id: 'other', label: 'Other Settings', icon: SlidersHorizontal, description: 'Pages, theme, preferences' }`
   - Add case in `renderContent()` for `'other'` returning `<OtherSettings />`

2. **`src/App.tsx`**
   - Wrap routes with `UserSettingsProvider`
   - On auth, redirect to user's `default_landing_page` if set

3. **`src/components/layout/AppSidebar.tsx`**
   - Read `hiddenPages` from user settings context
   - Filter `mainNavItems` to exclude hidden pages

4. **`src/components/layout/BottomNav.tsx`**
   - Same filtering for `moreMenuItems`

5. **`src/index.css`** (if needed)
   - Ensure dark mode class support via Tailwind `darkMode: 'class'`

### Theme Implementation
Use `next-themes` (already installed) `ThemeProvider` wrapping the app, with a toggle in OtherSettings between `light`, `dark`, `system`.

### Key Details
- Pages that can be hidden: Front Desk, Availability, Channel Manager, Room Status
- Pages that cannot be hidden: Dashboard, Bookings, New Booking, Settings, Properties
- Viewer role can still customize their own page visibility and theme
- Hidden pages are still accessible via direct URL (no security concern, just UX declutter)


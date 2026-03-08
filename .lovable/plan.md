

## Plan: Auto-Update USD/LKR Exchange Rate Hourly

### Overview
Create an edge function that fetches the live rate from `api.exchangerate.host`, stores it in `property_inventory_settings`, and schedule it hourly via `pg_cron`. Update the Settings UI to show last-updated time and a manual refresh button. Update the Dashboard widget to show the live DB rate with timestamp.

### Changes

#### 1. New Edge Function: `supabase/functions/fx-rate-update/index.ts`
- Fetches `https://api.exchangerate.host/latest?base=USD&symbols=LKR`
- Updates ALL rows in `property_inventory_settings` with the new rate and `fx_updated_at = now()`
- Uses service role key (no auth needed, called by cron)
- CORS headers included for manual invocation from frontend

#### 2. Config: `supabase/config.toml`
- Add `[functions.fx-rate-update]` with `verify_jwt = false`

#### 3. Database: Schedule hourly cron job
- Enable `pg_cron` and `pg_net` extensions (migration)
- Insert cron schedule via insert tool to call the edge function every hour

#### 4. Settings — `src/components/settings/HotelSettings.tsx`
- Add a "Fetch Live Rate" button next to the manual rate input
- Calls `supabase.functions.invoke('fx-rate-update')` then refreshes the displayed rate
- Shows last-updated timestamp more prominently
- Keep the manual override option as-is

#### 5. Dashboard — `src/pages/Index.tsx`
- Update the exchange rate widget to show `fx_updated_at` timestamp (e.g., "Updated 5 min ago")
- The rate already reads from DB, so the hourly cron keeps it fresh automatically

### Files Modified/Created
- `supabase/functions/fx-rate-update/index.ts` — New edge function
- `supabase/config.toml` — Add function config (auto-managed, just noting)
- `src/components/settings/HotelSettings.tsx` — Add live fetch button
- `src/pages/Index.tsx` — Show last-updated time on exchange rate widget
- Migration: enable `pg_cron` + `pg_net` extensions
- Insert: cron schedule record


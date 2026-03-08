

# OTA / Channel Integrations Tab — Implementation Plan

## Overview

Add an **"OTA Sync"** tab to the existing Rate Management settings. The `ota_integrations` table already exists in the database with RLS policies in place. This is purely a UI + stub integration task.

## What Already Exists

- **DB table**: `ota_integrations` with `property_id`, `ota_name`, `display_name`, `api_key`, `is_enabled`, `status`, timestamps — already created with RLS (admin manage, staff view)
- **Rate Management tabs**: Rate Plans, Seasonal, Day of Week, Discounts, Occupancy, Change Log
- **Channel Manager**: Separate settings page with connections, sync, email import — unrelated to this new tab

## Implementation

### 1. New Component: `src/components/settings/OtaSyncTab.tsx`

Three sub-tabs inside:

**Connected OTAs** — Grid of cards for Booking.com, Airbnb, Expedia, Agoda:
- OTA name + icon
- Status badge: "Coming Soon" / "Disabled" / "Active"
- Greyed-out API key field (masked, non-editable for now)
- Enable toggle with tooltip: "Will be active once API key is configured"
- Auto-seeds default OTA rows into `ota_integrations` on first load if none exist

**Settings** — Future API key entry area, currently showing "Coming Soon" message per OTA

**Sync History** — Placeholder table for future rate/availability push logs, showing empty state for now

**Simulate OTA Bookings** (admin-only) — Toggle + "Generate Test Booking" button that:
- Creates a booking with `booking_source` = random OTA, `needs_review = true`
- Picks a random available room for near-future dates
- Validates via rate engine and overlap prevention
- Useful for testing without real API keys

### 2. Stub Integration Service: `src/lib/channelIntegration.ts`

```typescript
interface IChannelIntegration {
  pushRates(propertyId: string, roomTypeId: string, ratePlanId: string): Promise<void>;
  pushAvailability(propertyId: string, roomTypeId: string, date: string, status: string): Promise<void>;
}

class StubChannelIntegration implements IChannelIntegration {
  // Console.log only — swap for real implementation later
}
```

Export singleton instance for use in rate change and booking confirmation flows.

### 3. Modified: `src/components/settings/RateManagementSettings.tsx`

- Add new tab trigger: `<TabsTrigger value="otasync">OTA Sync</TabsTrigger>`
- Add `<TabsContent value="otasync"><OtaSyncTab /></TabsContent>`
- Import `Plug` icon from lucide-react

### 4. No Database Changes Needed

The `ota_integrations` table and RLS policies already exist.

## Files Summary

| File | Action |
|------|--------|
| `src/components/settings/OtaSyncTab.tsx` | Create |
| `src/lib/channelIntegration.ts` | Create |
| `src/components/settings/RateManagementSettings.tsx` | Add OTA Sync tab |


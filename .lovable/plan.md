
# Channel Manager Feature Plan

## ✅ IMPLEMENTATION COMPLETE

All phases of the Channel Manager have been implemented:

### Completed Items
- ✅ Database schema (channel_connections, room_availability, property_inventory_settings, sync_logs)
- ✅ Property inventory settings UI
- ✅ Channel connections UI (enable/disable, commission rates, iCal URLs)
- ✅ Availability Calendar page (/availability) - visual grid of rooms/dates
- ✅ iCal export edge function - generates calendar feeds for OTAs
- ✅ iCal import edge function - parses OTA calendars
- ✅ Channel sync orchestrator edge function
- ✅ Conflict detection in booking flow
- ✅ Sync dashboard with logs
- ✅ Manual sync button functionality

### To Set Up Automated Sync (pg_cron)
Run this SQL in Cloud View > Run SQL to enable hourly sync:
```sql
SELECT cron.schedule(
  'channel-sync-hourly',
  '0 * * * *',
  $$SELECT net.http_post(
    url:='https://phybclqyaykozitpkdsf.supabase.co/functions/v1/channel-sync',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoeWJjbHF5YXlrb3ppdHBrZHNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwOTc2MDAsImV4cCI6MjA4NTY3MzYwMH0.KzY2I-GXWKjjzOIkpt-MkpO5nYnU-Iq_nq4k84vhQnM"}'::jsonb,
    body:='{}'::jsonb
  );$$
);
```

---

## Overview (Original)

---

## Phased Implementation Approach

### Phase 1: Core Infrastructure (Foundation)

**1.1 Database Schema Updates**

New tables required:

```text
channel_connections
+------------------+----------+------------------------------------------+
| Column           | Type     | Purpose                                  |
+------------------+----------+------------------------------------------+
| id               | uuid     | Primary key                              |
| property_id      | uuid     | FK to properties                         |
| channel_type     | enum     | booking_com, airbnb, agoda, etc.        |
| is_enabled       | boolean  | Enable/disable channel                   |
| api_key          | text     | Encrypted API credentials (optional)     |
| ical_import_url  | text     | iCal URL to import from channel         |
| ical_export_url  | text     | Generated iCal URL for export           |
| last_sync_at     | timestamp| Last successful sync                     |
| sync_status      | enum     | active, error, disabled                 |
| commission_rate  | numeric  | Default commission for this channel      |
| created_at       | timestamp|                                          |
+------------------+----------+------------------------------------------+

room_availability
+------------------+----------+------------------------------------------+
| Column           | Type     | Purpose                                  |
+------------------+----------+------------------------------------------+
| id               | uuid     | Primary key                              |
| room_id          | uuid     | FK to rooms                              |
| date             | date     | Specific date                            |
| is_available     | boolean  | Availability on this date               |
| blocked_reason   | text     | maintenance, hold, buffer, etc.         |
| booking_id       | uuid     | FK to bookings (if booked)              |
| source_channel   | enum     | Which channel made this unavailable     |
| created_at       | timestamp|                                          |
+------------------+----------+------------------------------------------+

property_inventory_settings
+------------------+----------+------------------------------------------+
| Column           | Type     | Purpose                                  |
+------------------+----------+------------------------------------------+
| id               | uuid     | Primary key                              |
| property_id      | uuid     | FK to properties                         |
| safety_buffer    | integer  | Rooms held back (default: 1)            |
| auto_close_at    | integer  | Auto-close availability X rooms left    |
| sync_frequency   | enum     | realtime, 5min, 15min, hourly           |
| created_at       | timestamp|                                          |
+------------------+----------+------------------------------------------+

sync_logs
+------------------+----------+------------------------------------------+
| Column           | Type     | Purpose                                  |
+------------------+----------+------------------------------------------+
| id               | uuid     | Primary key                              |
| channel_id       | uuid     | FK to channel_connections               |
| direction        | enum     | inbound, outbound                       |
| status           | enum     | success, failed, partial                |
| records_synced   | integer  | Number of bookings/dates synced         |
| error_message    | text     | Error details if failed                 |
| created_at       | timestamp|                                          |
+------------------+----------+------------------------------------------+
```

**1.2 Availability Calendar System**

- Create a master availability calendar component showing all rooms/dates
- Calculate real-time availability: `total_rooms - active_bookings - blocked_rooms - safety_buffer`
- Visual indicators for each room/date state

---

### Phase 2: Channel Management UI

**2.1 Channel Settings Page** (`/settings/channels`)

- List of supported channels with enable/disable toggles
- Per-property channel configuration
- Room type mapping (your room types to channel room types)
- Commission rate defaults per channel
- iCal URL display for manual sync (Phase 1 approach)

**2.2 Inventory Settings**

- Safety buffer configuration per property
- Auto-close threshold settings
- Manual block dates feature (maintenance, events)
- Bulk availability updates

**2.3 Sync Dashboard**

- Real-time sync status per channel
- Last sync timestamp
- Error notifications
- Manual sync trigger button
- Sync history log

---

### Phase 3: iCal Sync (Realistic First Implementation)

Since Booking.com and Airbnb APIs require business verification and approval (which can take weeks/months), we'll start with iCal sync which works immediately.

**3.1 iCal Export Edge Function**

Generate iCal feeds for your properties that OTAs can subscribe to:

```text
GET /functions/v1/ical-export?property_id=xxx&room_type=deluxe
```

Returns standard iCal format with blocked dates.

**3.2 iCal Import Edge Function**

Parse iCal feeds from OTAs to import their bookings:

- Scheduled background task (every 15 minutes)
- Parse iCal from Booking.com/Airbnb URLs
- Create bookings in your system
- Update availability calendar
- Trigger outbound sync to other channels

**3.3 Conflict Detection**

- Before confirming any booking, check availability calendar
- If conflict detected, reject with clear error
- Log all conflicts for reporting

---

### Phase 4: Real-Time API Integration (Future)

**4.1 Webhook Endpoints**

Edge functions to receive booking notifications:

- `POST /functions/v1/channel-webhook/booking-com`
- `POST /functions/v1/channel-webhook/airbnb`

**4.2 Outbound Push Notifications**

When availability changes:
1. Update local availability calendar
2. Queue sync job for all connected channels
3. Push updates via API (when approved)

**4.3 Booking Lock Mechanism**

Prevent race conditions:
- When processing a booking, lock inventory for 30 seconds
- Use database-level locking with `FOR UPDATE`
- Release lock on complete or timeout

---

## Implementation Order

| Step | Component | Description |
|------|-----------|-------------|
| 1 | Database migrations | Create new tables with RLS policies |
| 2 | Property inventory settings | UI to configure buffer and sync settings |
| 3 | Channel connections UI | Enable/disable channels per property |
| 4 | Availability calendar view | Visual room/date availability grid |
| 5 | iCal export function | Generate iCal feeds for OTAs |
| 6 | iCal import function | Parse OTA calendars |
| 7 | Sync scheduler | Background job for periodic sync |
| 8 | Conflict detection | Pre-booking availability check |
| 9 | Sync dashboard | Monitor sync status and logs |

---

## Technical Specifications

### Updated Booking Flow (with Channel Manager)

```text
New Booking Request (from any source)
          |
          v
   Check Availability Calendar
          |
          v
    Is Room Available?
       /       \
      No        Yes
      |          |
      v          v
   Reject    Lock Inventory (30s)
              |
              v
        Create Booking
              |
              v
     Update Availability Calendar
              |
              v
    Push to All Connected Channels
              |
              v
        Release Lock
```

### Safety Buffer Logic

For a property with:
- 6 total rooms of type "deluxe"
- 2 active bookings
- 1 safety buffer

Sellable inventory = 6 - 2 - 1 = **3 rooms available**

When availability drops to buffer level, auto-close on OTAs.

---

## Files to Create/Modify

### New Files
- `src/pages/ChannelManager.tsx` - Main channel management page
- `src/pages/AvailabilityCalendar.tsx` - Visual availability grid
- `src/components/channels/ChannelCard.tsx` - Channel configuration card
- `src/components/channels/InventorySettings.tsx` - Buffer settings
- `src/components/channels/SyncStatus.tsx` - Sync status display
- `supabase/functions/ical-export/index.ts` - iCal feed generator
- `supabase/functions/ical-import/index.ts` - iCal parser
- `supabase/functions/channel-sync/index.ts` - Sync orchestrator

### Modified Files
- `src/pages/NewBooking.tsx` - Add availability check before booking
- `src/components/layout/AppSidebar.tsx` - Add Channel Manager nav link
- `src/pages/Settings.tsx` - Link to channel settings

---

## Considerations

### What This Enables
- Prevent double bookings across all platforms
- Single dashboard to manage all channels
- Automatic commission tracking by source
- Clear visibility into room inventory
- Professional channel management workflow

### Limitations of iCal Sync (Phase 1)
- Sync delay of 15-30 minutes (not real-time)
- Limited to blocked dates (no rate management)
- No automatic booking details (just blocked periods)

### Path to Full API Integration
- Apply for Booking.com Partner API access
- Apply for Airbnb Host API access
- Both require business verification
- Once approved, upgrade to real-time webhooks

---

## Estimated Complexity

| Phase | Effort | Priority |
|-------|--------|----------|
| Phase 1: Database + Core | Medium | High |
| Phase 2: Channel UI | Medium | High |
| Phase 3: iCal Sync | High | High |
| Phase 4: API Integration | High | Future |

This plan transforms your booking app into a professional-grade hotel operations platform with built-in channel management capabilities.

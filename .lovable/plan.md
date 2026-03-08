

# Security Scan Results & Fix Plan

## Scan Results (3 findings)

### Finding 1: Leaked Password Protection Disabled (WARN)
This is a platform-level setting that must be enabled manually in your backend authentication settings. It cannot be changed via code.

**Action required from you**: Open your backend settings and enable "Leaked Password Protection" under Authentication.

### Finding 2: OTA API Credentials Readable by All Staff (WARN)
The `channel_connections` table SELECT policy uses `is_staff()`, meaning front desk and viewer roles can read sensitive columns like `api_key`, `ical_export_token`, and `ical_import_url`. These should only be visible to admin and manager roles.

**Fix**: Update the SELECT RLS policy on `channel_connections` from `is_staff()` to `is_admin() OR is_manager()`.

### Finding 3: Admin/Manager Cannot See Property-Specific Notifications (WARN)
The `user_has_notification_access` function checks `user_property_access` for all roles, but admins and managers should bypass property filtering (consistent with the rest of the access model). An admin without explicit property access rows would miss notifications.

**Fix**: Update `user_has_notification_access` to return TRUE immediately when `is_admin() OR is_manager()`.

---

## Implementation

### Database Migration
A single migration will:

1. **Drop and recreate** the `channel_connections` SELECT policy:
   - Old: `is_staff()`
   - New: `is_admin() OR is_manager()`

2. **Replace** `user_has_notification_access` function to add admin/manager bypass:
   ```sql
   SELECT
     CASE
       WHEN is_admin() OR is_manager() THEN TRUE
       ELSE is_staff()
         AND (notification_target_roles IS NULL
              OR notification_target_roles && ARRAY[(SELECT role::text FROM user_roles WHERE user_id = auth.uid() LIMIT 1)])
         AND (notification_property_id IS NULL
              OR EXISTS (SELECT 1 FROM user_property_access WHERE user_id = auth.uid() AND property_id = notification_property_id))
     END
   ```

### Frontend Impact
- The Channel Manager page already restricts UI to admin/manager — no frontend changes needed.
- Notifications pages work unchanged since admins/managers will now correctly see all notifications.

### No code file changes required — only one database migration.

---

## Regarding the Other Two Requests

### End-to-End Booking Flow Test
This requires interactive browser testing (creating a booking, checking in, adding services, checking out, verifying invoice). This should be done manually in the preview after the security fixes are applied. The code paths for all these operations have been verified in prior audits.

### Mobile Responsive Check (375px)
This also requires browser-based visual inspection. You can test this by clicking the phone icon above the preview window to switch to mobile view, then navigating through each page.


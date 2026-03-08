
# Secure Passport Photo Upload — Implementation Plan

## Current State (Security Issues Found)

1. **Direct Supabase Storage calls** — Frontend calls `supabase.storage.upload()` directly
2. **Bucket `guest-documents`** exists but uses basic RLS — no user folder isolation
3. **No server-side validation** — file type/size only checked client-side
4. **No rate limiting** — unlimited uploads
5. **Security scan flagged 3 issues**:
   - Leaked Password Protection disabled (manual action)
   - All 124 RLS policies are RESTRICTIVE (fix via migration)
   - Missing `is_front_desk()` and `is_viewer()` functions (already exist, false positive)

---

## Implementation Overview

### 1. Database Migration

**Create `passport_photos` table** for audit and soft-delete:
- `id`, `guest_id`, `property_id`, `uploaded_by`, `storage_path`
- `created_at`, `deleted_at`, `scheduled_purge_at` (3 months after delete)
- RLS: staff can insert/view for accessible guests; admin can delete

**Create new private `passports` bucket** with strict RLS:
```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('passports', 'passports', false);

-- Storage RLS on storage.objects for bucket 'passports':
-- INSERT: is_write_staff() only
-- SELECT: is_staff() AND can_access_guest()
-- UPDATE: is_admin()
-- DELETE: is_admin()
```

**Add `upload_rate_limits` table**:
- `user_id`, `action_type`, `window_start`, `request_count`
- Used by edge function for rate limiting

---

### 2. Edge Function: `passport-upload`

Handles secure uploads with:
1. **JWT auth** — reject anonymous
2. **Role check** — `is_write_staff()` via database function
3. **Rate limit** — max 3 uploads/hour per user (checked via `upload_rate_limits` table)
4. **File validation**:
   - Max 5MB
   - JPEG/PNG only (magic bytes check, not just extension)
   - Image resize/compression to 1200px max dimension
5. **Storage path**: `{property_id}/{guest_id}/{uuid}.jpg`
6. **Returns**: signed URL for immediate display

---

### 3. Edge Function: `passport-view`

Returns signed URL for viewing:
1. **JWT auth** — reject anonymous
2. **Access check** — `can_access_guest()` for the guest_id
3. **Audit log** — record view in `guest_view_logs`
4. **Returns**: short-lived signed URL (5 minutes)

---

### 4. Edge Function: `passport-delete`

Soft-deletes the photo:
1. **JWT auth** + **admin check**
2. Sets `deleted_at` on `passport_photos` record
3. Sets `scheduled_purge_at` = NOW() + 3 months
4. Photo remains in storage until purge job runs
5. Returns success

---

### 5. Edge Function: `passport-purge` (cron)

Scheduled job to permanently delete old photos:
1. Query `passport_photos WHERE scheduled_purge_at < NOW()`
2. Delete from storage
3. Delete from `passport_photos` table
4. Log to `audit_logs`

---

### 6. Frontend Changes (`GuestDetails.tsx`)

Replace direct Supabase calls with edge function calls:
- `handlePassportUpload` → calls `passport-upload` edge function
- `fetchPassportUrl` → calls `passport-view` edge function
- Add delete button (admin only) → calls `passport-delete`
- Show "Deleted" state with "Photo will be purged in X days" message

---

### 7. Security Fixes (from scan)

1. **Convert RESTRICTIVE to PERMISSIVE policies** — already have migration, ensure it's applied
2. **Leaked Password Protection** — manual action, cannot automate

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/migrations/XXXX_passport_security.sql` | Create bucket, RLS, tables |
| `supabase/functions/passport-upload/index.ts` | New edge function |
| `supabase/functions/passport-view/index.ts` | New edge function |
| `supabase/functions/passport-delete/index.ts` | New edge function |
| `supabase/functions/passport-purge/index.ts` | New scheduled function |
| `supabase/config.toml` | Register new functions |
| `src/pages/GuestDetails.tsx` | Replace direct storage calls |

---

## Rate Limiting Implementation

Edge function checks `upload_rate_limits`:
```sql
SELECT request_count FROM upload_rate_limits
WHERE user_id = $1 AND action_type = 'passport_upload'
AND window_start > NOW() - INTERVAL '1 hour';
```
If count >= 3, reject with 429. Otherwise increment counter.

---

## Test Checklist

- [ ] Anonymous user cannot upload → 401
- [ ] Viewer role cannot upload → 403
- [ ] Front desk can upload for accessible guest
- [ ] File > 5MB rejected
- [ ] Non-image file rejected (e.g., PDF renamed to .jpg)
- [ ] Rate limit kicks in after 3 uploads
- [ ] Signed URL expires after 5 minutes
- [ ] Admin soft-delete works
- [ ] Purge job removes files after 3 months
- [ ] Guest without property access cannot view photo

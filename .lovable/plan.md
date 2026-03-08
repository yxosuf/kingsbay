

## Plan: Fix Property Delete (Replace `confirm()` with AlertDialog)

### Root Cause
The `handleDelete` function on line 97 uses `window.confirm()`, which is blocked in sandboxed iframe environments (like the preview). The dialog never shows, `confirm()` returns `false`, and the delete is silently skipped.

### Changes

#### `src/pages/Properties.tsx`
- Add state for delete confirmation: `deletePropertyId` and `showDeleteDialog`
- Replace the `if (!confirm(...)) return;` with setting state to open an `AlertDialog`
- Add an `AlertDialog` component (already imported pattern from DangerZoneSettings) with:
  - Warning text about the consequences of deleting a property
  - Cancel and Confirm Destructive buttons
- On confirm, execute the existing delete logic via Supabase
- Import `AlertDialog` components (already available in the project)

This is a UI-only fix — the RLS policy `"Admin can delete properties"` already exists and works. The admin role check is already in place on the page (line 114).

### Files Modified
- `src/pages/Properties.tsx` — Replace `confirm()` with `AlertDialog`


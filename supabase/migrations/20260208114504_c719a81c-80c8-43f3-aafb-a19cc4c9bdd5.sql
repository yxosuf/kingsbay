-- Fix: Remove overly permissive INSERT policy on notifications table
-- Edge functions use service role which bypasses RLS, so this policy is not needed
-- and creates a security risk by allowing any authenticated user to insert notifications

DROP POLICY IF EXISTS "Service role can insert notifications" ON notifications;

-- Optionally, if we want staff to be able to create notifications from the UI:
-- CREATE POLICY "Staff can insert notifications"
--   ON notifications FOR INSERT
--   WITH CHECK (is_staff());

-- For now, only edge functions (via service role) should create notifications
-- No INSERT policy means only service role can insert (which bypasses RLS)
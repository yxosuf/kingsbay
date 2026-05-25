-- Restrict channel_connections SELECT to admin/manager only (hides OTA API keys from front_desk)
DROP POLICY IF EXISTS "Staff can view channel connections" ON public.channel_connections;

-- Admin/Manager already have view policy from previous migration; ensure it exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.channel_connections'::regclass
      AND polname = 'Admin/Manager can view channel connections'
  ) THEN
    CREATE POLICY "Admin/Manager can view channel connections"
      ON public.channel_connections
      FOR SELECT
      TO authenticated
      USING (is_admin() OR is_manager());
  END IF;
END$$;
-- Create ota_sync_logs table for tracking all OTA API interactions
CREATE TABLE IF NOT EXISTS public.ota_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  integration_id uuid NOT NULL REFERENCES public.ota_integrations(id) ON DELETE CASCADE,
  ota_name text NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('rate_push', 'availability_push', 'test_connection')),
  status text NOT NULL CHECK (status IN ('success', 'failure', 'pending')),
  request_payload jsonb,
  response_message text,
  error_message text,
  retry_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sync_logs_property ON public.ota_sync_logs(property_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_integration ON public.ota_sync_logs(integration_id);
CREATE INDEX IF NOT EXISTS idx_sync_logs_created ON public.ota_sync_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.ota_sync_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Staff can view sync logs" 
  ON public.ota_sync_logs FOR SELECT 
  USING (is_staff());

CREATE POLICY "Write staff can insert sync logs" 
  ON public.ota_sync_logs FOR INSERT 
  WITH CHECK (is_write_staff());

-- Extend ota_integrations table with sandbox and retry configuration
ALTER TABLE public.ota_integrations
  ADD COLUMN IF NOT EXISTS sandbox_mode boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_retry_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS max_retries integer DEFAULT 2;
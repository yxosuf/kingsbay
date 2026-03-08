
-- Add 'inspected' to housekeeping_status enum
ALTER TYPE public.housekeeping_status ADD VALUE IF NOT EXISTS 'inspected';

-- Add assigned_to, inspected_by, cleaning_started_at, cleaning_completed_at to rooms
ALTER TABLE public.rooms 
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS inspected_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cleaning_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS cleaning_completed_at timestamptz;

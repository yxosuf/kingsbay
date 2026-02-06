-- Add unique constraint for room_availability upsert
ALTER TABLE public.room_availability 
ADD CONSTRAINT room_availability_room_id_date_unique UNIQUE (room_id, date);

-- Enable pg_cron and pg_net extensions for scheduled syncing
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
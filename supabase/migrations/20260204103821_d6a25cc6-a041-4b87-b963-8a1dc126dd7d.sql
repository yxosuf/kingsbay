-- Create enums for channel manager
CREATE TYPE channel_type AS ENUM ('direct', 'booking_com', 'airbnb', 'agoda', 'expedia', 'other_ota');
CREATE TYPE sync_status AS ENUM ('active', 'error', 'disabled');
CREATE TYPE sync_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE sync_result_status AS ENUM ('success', 'failed', 'partial');
CREATE TYPE sync_frequency AS ENUM ('realtime', '5min', '15min', 'hourly');

-- Channel connections table
CREATE TABLE public.channel_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  channel_type channel_type NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  api_key TEXT,
  ical_import_url TEXT,
  ical_export_url TEXT,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_status sync_status NOT NULL DEFAULT 'disabled',
  commission_rate NUMERIC CHECK (commission_rate >= 0 AND commission_rate <= 100),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(property_id, channel_type)
);

-- Room availability table (date-based inventory)
CREATE TABLE public.room_availability (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT true,
  blocked_reason TEXT,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  source_channel channel_type,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(room_id, date)
);

-- Property inventory settings
CREATE TABLE public.property_inventory_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE UNIQUE,
  safety_buffer INTEGER NOT NULL DEFAULT 1 CHECK (safety_buffer >= 0),
  auto_close_at INTEGER NOT NULL DEFAULT 0 CHECK (auto_close_at >= 0),
  sync_frequency sync_frequency NOT NULL DEFAULT 'hourly',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Sync logs table
CREATE TABLE public.sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES public.channel_connections(id) ON DELETE CASCADE,
  direction sync_direction NOT NULL,
  status sync_result_status NOT NULL,
  records_synced INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.channel_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_inventory_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for channel_connections
CREATE POLICY "Staff can view channel connections"
  ON public.channel_connections FOR SELECT
  USING (is_staff());

CREATE POLICY "Admin/Manager can insert channel connections"
  ON public.channel_connections FOR INSERT
  WITH CHECK (is_admin() OR is_manager());

CREATE POLICY "Admin/Manager can update channel connections"
  ON public.channel_connections FOR UPDATE
  USING (is_admin() OR is_manager());

CREATE POLICY "Admin can delete channel connections"
  ON public.channel_connections FOR DELETE
  USING (is_admin());

-- RLS policies for room_availability
CREATE POLICY "Staff can view room availability"
  ON public.room_availability FOR SELECT
  USING (is_staff());

CREATE POLICY "Staff can insert room availability"
  ON public.room_availability FOR INSERT
  WITH CHECK (is_staff());

CREATE POLICY "Staff can update room availability"
  ON public.room_availability FOR UPDATE
  USING (is_staff());

CREATE POLICY "Admin/Manager can delete room availability"
  ON public.room_availability FOR DELETE
  USING (is_admin() OR is_manager());

-- RLS policies for property_inventory_settings
CREATE POLICY "Staff can view inventory settings"
  ON public.property_inventory_settings FOR SELECT
  USING (is_staff());

CREATE POLICY "Admin/Manager can insert inventory settings"
  ON public.property_inventory_settings FOR INSERT
  WITH CHECK (is_admin() OR is_manager());

CREATE POLICY "Admin/Manager can update inventory settings"
  ON public.property_inventory_settings FOR UPDATE
  USING (is_admin() OR is_manager());

CREATE POLICY "Admin can delete inventory settings"
  ON public.property_inventory_settings FOR DELETE
  USING (is_admin());

-- RLS policies for sync_logs
CREATE POLICY "Staff can view sync logs"
  ON public.sync_logs FOR SELECT
  USING (is_staff());

CREATE POLICY "System can insert sync logs"
  ON public.sync_logs FOR INSERT
  WITH CHECK (is_staff());

-- Create indexes for performance
CREATE INDEX idx_channel_connections_property ON public.channel_connections(property_id);
CREATE INDEX idx_room_availability_room_date ON public.room_availability(room_id, date);
CREATE INDEX idx_room_availability_date ON public.room_availability(date);
CREATE INDEX idx_sync_logs_channel ON public.sync_logs(channel_id);
CREATE INDEX idx_sync_logs_created ON public.sync_logs(created_at DESC);

-- Add triggers for updated_at
CREATE TRIGGER update_channel_connections_updated_at
  BEFORE UPDATE ON public.channel_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_room_availability_updated_at
  BEFORE UPDATE ON public.room_availability
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_property_inventory_settings_updated_at
  BEFORE UPDATE ON public.property_inventory_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
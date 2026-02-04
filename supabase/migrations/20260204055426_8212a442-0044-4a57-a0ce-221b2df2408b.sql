-- Create property type enum
CREATE TYPE public.property_type AS ENUM ('hotel', 'villa', 'resort', 'apartment', 'guesthouse');

-- Create properties table
CREATE TABLE public.properties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  property_type public.property_type NOT NULL DEFAULT 'hotel',
  location TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  description TEXT,
  total_rooms INTEGER DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add property_id to rooms
ALTER TABLE public.rooms ADD COLUMN property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE;

-- Add property_id to bookings
ALTER TABLE public.bookings ADD COLUMN property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL;

-- Add property_id to guest_services
ALTER TABLE public.guest_services ADD COLUMN property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL;

-- Add property_id to invoices
ALTER TABLE public.invoices ADD COLUMN property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL;

-- Add property_id to payments
ALTER TABLE public.payments ADD COLUMN property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL;

-- Create user property access table for role-based property access
CREATE TABLE public.user_property_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, property_id)
);

-- Enable RLS on properties
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

-- Properties RLS policies
CREATE POLICY "Staff can view active properties they have access to"
ON public.properties FOR SELECT
USING (
  is_staff() AND (
    is_admin() OR is_manager() OR 
    EXISTS (
      SELECT 1 FROM public.user_property_access 
      WHERE user_id = auth.uid() AND property_id = properties.id
    ) OR
    NOT EXISTS (SELECT 1 FROM public.user_property_access WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Admin can insert properties"
ON public.properties FOR INSERT
WITH CHECK (is_admin());

CREATE POLICY "Admin can update properties"
ON public.properties FOR UPDATE
USING (is_admin());

CREATE POLICY "Admin can delete properties"
ON public.properties FOR DELETE
USING (is_admin());

-- Enable RLS on user_property_access
ALTER TABLE public.user_property_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage property access"
ON public.user_property_access FOR ALL
USING (is_admin());

CREATE POLICY "Users can view their own property access"
ON public.user_property_access FOR SELECT
USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_rooms_property_id ON public.rooms(property_id);
CREATE INDEX idx_bookings_property_id ON public.bookings(property_id);
CREATE INDEX idx_guest_services_property_id ON public.guest_services(property_id);
CREATE INDEX idx_invoices_property_id ON public.invoices(property_id);
CREATE INDEX idx_payments_property_id ON public.payments(property_id);
CREATE INDEX idx_user_property_access_user_id ON public.user_property_access(user_id);

-- Trigger for updated_at
CREATE TRIGGER update_properties_updated_at
BEFORE UPDATE ON public.properties
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Comment for documentation
COMMENT ON TABLE public.properties IS 'Hotels, villas, resorts managed by the system';
COMMENT ON COLUMN public.rooms.property_id IS 'The property this room belongs to';
COMMENT ON COLUMN public.bookings.property_id IS 'The property this booking is for (denormalized from room for query performance)';
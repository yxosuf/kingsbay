-- Create role enum for staff
CREATE TYPE public.staff_role AS ENUM ('admin', 'front_desk', 'manager');

-- Create room status enum
CREATE TYPE public.room_status AS ENUM ('available', 'occupied', 'reserved', 'maintenance');

-- Create booking status enum
CREATE TYPE public.booking_status AS ENUM ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'archived');

-- Create payment status enum
CREATE TYPE public.payment_status AS ENUM ('pending', 'partial', 'paid');

-- Create service category enum
CREATE TYPE public.service_category AS ENUM ('room_service', 'transport', 'facilities', 'special_request');

-- Create payment method enum
CREATE TYPE public.payment_method AS ENUM ('cash', 'card', 'bank_transfer', 'online');

-- ============================================
-- PROFILES TABLE (for user display info)
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- USER ROLES TABLE (separate from profiles for security)
-- ============================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role staff_role NOT NULL DEFAULT 'front_desk',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- ============================================
-- GUESTS TABLE
-- ============================================
CREATE TABLE public.guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  id_passport TEXT,
  address TEXT,
  nationality TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- ROOMS TABLE
-- ============================================
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_number TEXT NOT NULL UNIQUE,
  room_type TEXT NOT NULL DEFAULT 'standard',
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  status room_status NOT NULL DEFAULT 'available',
  amenities TEXT[],
  max_guests INTEGER DEFAULT 2,
  floor INTEGER,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- BOOKINGS TABLE
-- ============================================
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id UUID NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  num_guests INTEGER DEFAULT 1,
  status booking_status NOT NULL DEFAULT 'pending',
  special_requests TEXT,
  total_amount DECIMAL(10,2) DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- SERVICES TABLE
-- ============================================
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category service_category NOT NULL DEFAULT 'room_service',
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- GUEST SERVICES TABLE (services used by guests)
-- ============================================
CREATE TABLE public.guest_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  notes TEXT,
  service_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- INVOICES TABLE
-- ============================================
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  room_charges DECIMAL(10,2) NOT NULL DEFAULT 0,
  service_charges DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  payment_status payment_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- PAYMENTS TABLE
-- ============================================
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  method payment_method NOT NULL DEFAULT 'cash',
  payment_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  reference_number TEXT,
  notes TEXT,
  received_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- HELPER FUNCTIONS (Security Definer to avoid RLS recursion)
-- ============================================

-- Check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role staff_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

-- Check if user is manager
CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'manager')
$$;

-- Check if user is front desk
CREATE OR REPLACE FUNCTION public.is_front_desk()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'front_desk')
$$;

-- Check if user is any staff member
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
  )
$$;

-- ============================================
-- AUTO-CREATE PROFILE ON USER SIGNUP
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- UPDATE TIMESTAMPS TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_guests_updated_at BEFORE UPDATE ON public.guests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON public.rooms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES: PROFILES
-- ============================================
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Staff can view all profiles" ON public.profiles FOR SELECT USING (public.is_staff());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- ============================================
-- RLS POLICIES: USER_ROLES (Admin only can manage)
-- ============================================
CREATE POLICY "Staff can view all roles" ON public.user_roles FOR SELECT USING (public.is_staff());
CREATE POLICY "Admin can insert roles" ON public.user_roles FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admin can update roles" ON public.user_roles FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admin can delete roles" ON public.user_roles FOR DELETE USING (public.is_admin());

-- ============================================
-- RLS POLICIES: GUESTS
-- ============================================
CREATE POLICY "Staff can view all guests" ON public.guests FOR SELECT USING (public.is_staff());
CREATE POLICY "Staff can insert guests" ON public.guests FOR INSERT WITH CHECK (public.is_staff());
CREATE POLICY "Staff can update guests" ON public.guests FOR UPDATE USING (public.is_staff());
CREATE POLICY "Admin can delete guests" ON public.guests FOR DELETE USING (public.is_admin());

-- ============================================
-- RLS POLICIES: ROOMS
-- ============================================
CREATE POLICY "Staff can view all rooms" ON public.rooms FOR SELECT USING (public.is_staff());
CREATE POLICY "Admin can insert rooms" ON public.rooms FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admin/Manager can update rooms" ON public.rooms FOR UPDATE USING (public.is_admin() OR public.is_manager());
CREATE POLICY "Admin can delete rooms" ON public.rooms FOR DELETE USING (public.is_admin());

-- ============================================
-- RLS POLICIES: BOOKINGS
-- ============================================
CREATE POLICY "Staff can view all bookings" ON public.bookings FOR SELECT USING (public.is_staff());
CREATE POLICY "Staff can insert bookings" ON public.bookings FOR INSERT WITH CHECK (public.is_staff());
CREATE POLICY "Staff can update bookings" ON public.bookings FOR UPDATE USING (public.is_staff());
CREATE POLICY "Admin/Manager can delete bookings" ON public.bookings FOR DELETE USING (public.is_admin() OR public.is_manager());

-- ============================================
-- RLS POLICIES: SERVICES
-- ============================================
CREATE POLICY "Staff can view all services" ON public.services FOR SELECT USING (public.is_staff());
CREATE POLICY "Admin can insert services" ON public.services FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admin can update services" ON public.services FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admin can delete services" ON public.services FOR DELETE USING (public.is_admin());

-- ============================================
-- RLS POLICIES: GUEST_SERVICES
-- ============================================
CREATE POLICY "Staff can view all guest services" ON public.guest_services FOR SELECT USING (public.is_staff());
CREATE POLICY "Staff can insert guest services" ON public.guest_services FOR INSERT WITH CHECK (public.is_staff());
CREATE POLICY "Staff can update guest services" ON public.guest_services FOR UPDATE USING (public.is_staff());
CREATE POLICY "Admin/Manager can delete guest services" ON public.guest_services FOR DELETE USING (public.is_admin() OR public.is_manager());

-- ============================================
-- RLS POLICIES: INVOICES
-- ============================================
CREATE POLICY "Staff can view all invoices" ON public.invoices FOR SELECT USING (public.is_staff());
CREATE POLICY "Staff can insert invoices" ON public.invoices FOR INSERT WITH CHECK (public.is_staff());
CREATE POLICY "Staff can update invoices" ON public.invoices FOR UPDATE USING (public.is_staff());
CREATE POLICY "Admin can delete invoices" ON public.invoices FOR DELETE USING (public.is_admin());

-- ============================================
-- RLS POLICIES: PAYMENTS
-- ============================================
CREATE POLICY "Staff can view all payments" ON public.payments FOR SELECT USING (public.is_staff());
CREATE POLICY "Staff can insert payments" ON public.payments FOR INSERT WITH CHECK (public.is_staff());
CREATE POLICY "Staff can update payments" ON public.payments FOR UPDATE USING (public.is_staff());
CREATE POLICY "Admin can delete payments" ON public.payments FOR DELETE USING (public.is_admin());

-- ============================================
-- GENERATE INVOICE NUMBER FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 5) AS INTEGER)), 0) + 1
  INTO next_num
  FROM public.invoices
  WHERE invoice_number LIKE 'INV-%';
  
  NEW.invoice_number := 'INV-' || LPAD(next_num::TEXT, 6, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER generate_invoice_number_trigger
  BEFORE INSERT ON public.invoices
  FOR EACH ROW
  WHEN (NEW.invoice_number IS NULL OR NEW.invoice_number = '')
  EXECUTE FUNCTION public.generate_invoice_number();
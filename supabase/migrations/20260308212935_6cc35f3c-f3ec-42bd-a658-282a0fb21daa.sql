
-- 1. Add auth_user_id column to guests table
ALTER TABLE public.guests ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_guests_auth_user_id ON public.guests(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- 2. Create is_guest() helper function
CREATE OR REPLACE FUNCTION public.is_guest() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT auth.uid() IS NOT NULL
    AND NOT public.is_staff()
    AND EXISTS (SELECT 1 FROM public.guests WHERE auth_user_id = auth.uid())
$$;

-- 3. Auto-create guest profile on registration when user_type = 'guest'
CREATE OR REPLACE FUNCTION public.handle_guest_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.raw_user_meta_data->>'user_type' = 'guest' THEN
    INSERT INTO public.guests (
      name, email, phone, auth_user_id, guest_type
    ) VALUES (
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      NEW.email,
      NEW.raw_user_meta_data->>'phone',
      NEW.id,
      'foreign'
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS on_guest_signup ON auth.users;
CREATE TRIGGER on_guest_signup AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_guest_signup();

-- 4. RLS: Guests can view their own guest profile
CREATE POLICY "Guest can view own profile"
ON public.guests FOR SELECT TO authenticated
USING (auth_user_id = auth.uid());

-- 5. RLS: Guests can update their own profile
CREATE POLICY "Guest can update own profile"
ON public.guests FOR UPDATE TO authenticated
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());

-- 6. RLS: Guests can view their own bookings
CREATE POLICY "Guest can view own bookings"
ON public.bookings FOR SELECT TO authenticated
USING (
  is_guest() AND guest_id IN (SELECT id FROM public.guests WHERE auth_user_id = auth.uid())
);

-- 7. RLS: Guests can insert bookings for themselves
CREATE POLICY "Guest can insert own bookings"
ON public.bookings FOR INSERT TO authenticated
WITH CHECK (
  is_guest() AND guest_id IN (SELECT id FROM public.guests WHERE auth_user_id = auth.uid())
);

-- 8. RLS: Guests can view available rooms (read-only)
CREATE POLICY "Guest can view rooms"
ON public.rooms FOR SELECT TO authenticated
USING (is_guest());

-- 9. RLS: Guests can view active rate plans
CREATE POLICY "Guest can view rate plans"
ON public.rate_plans FOR SELECT TO authenticated
USING (is_guest() AND is_active = true);

-- 10. RLS: Guests can view active properties
CREATE POLICY "Guest can view properties"
ON public.properties FOR SELECT TO authenticated
USING (is_guest() AND is_active = true);

-- 11. RLS: Guests can view active discount codes (for validation)
CREATE POLICY "Guest can view discount codes"
ON public.discount_codes FOR SELECT TO authenticated
USING (is_guest() AND is_active = true);

-- 12. RLS: Guests can insert discount code usages
CREATE POLICY "Guest can insert discount usages"
ON public.discount_code_usages FOR INSERT TO authenticated
WITH CHECK (is_guest());

-- 13. RLS: Guests can view their own profile in profiles table
CREATE POLICY "Guest can view own auth profile"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id);

-- 14. RLS: Guests can view rate plan room types
CREATE POLICY "Guest can view rate plan room types"
ON public.rate_plan_room_types FOR SELECT TO authenticated
USING (is_guest());

-- 15. RLS: Guests can view seasonal rules (for price display)
CREATE POLICY "Guest can view seasonal rules"
ON public.seasonal_rules FOR SELECT TO authenticated
USING (is_guest());

-- 16. RLS: Guests can view day of week rules
CREATE POLICY "Guest can view day of week rules"
ON public.day_of_week_rules FOR SELECT TO authenticated
USING (is_guest());

-- 17. RLS: Guests can view room availability
CREATE POLICY "Guest can view room availability"
ON public.room_availability FOR SELECT TO authenticated
USING (is_guest());

-- 18. RLS: Guests can view occupancy pricing rules
CREATE POLICY "Guest can view occupancy rules"
ON public.occupancy_pricing_rules FOR SELECT TO authenticated
USING (is_guest());

-- 19. RLS: Guests can view rate overrides (for price display)
CREATE POLICY "Guest can view rate overrides"
ON public.rate_overrides FOR SELECT TO authenticated
USING (is_guest());

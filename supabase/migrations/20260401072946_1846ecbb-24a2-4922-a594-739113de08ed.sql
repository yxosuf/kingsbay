
-- Let guests view active services
CREATE POLICY "Guest can view active services"
ON public.services FOR SELECT TO authenticated
USING (is_guest() AND is_active = true);

-- Let guests insert services on their own bookings
CREATE POLICY "Guest can insert own booking services"
ON public.guest_services FOR INSERT TO authenticated
WITH CHECK (
  is_guest() AND booking_id IN (
    SELECT b.id FROM bookings b
    JOIN guests g ON g.id = b.guest_id
    WHERE g.auth_user_id = auth.uid()
  )
);

-- Let guests view services on their own bookings
CREATE POLICY "Guest can view own booking services"
ON public.guest_services FOR SELECT TO authenticated
USING (
  is_guest() AND booking_id IN (
    SELECT b.id FROM bookings b
    JOIN guests g ON g.id = b.guest_id
    WHERE g.auth_user_id = auth.uid()
  )
);

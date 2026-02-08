-- 1) Fix existing bookings with null property_id by getting it from rooms
UPDATE public.bookings b
SET property_id = r.property_id
FROM public.rooms r
WHERE b.room_id = r.id
  AND b.property_id IS NULL
  AND r.property_id IS NOT NULL;

-- 2) Add property_id to guests table for strict property isolation
ALTER TABLE public.guests
ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES public.properties(id);

-- 3) Backfill guests.property_id from their most recent booking's property
UPDATE public.guests g
SET property_id = (
  SELECT b.property_id
  FROM public.bookings b
  WHERE b.guest_id = g.id
    AND b.property_id IS NOT NULL
  ORDER BY b.created_at DESC
  LIMIT 1
)
WHERE g.property_id IS NULL;

-- 4) Create index for guest property filtering
CREATE INDEX IF NOT EXISTS idx_guests_property_id ON public.guests(property_id);

-- 5) Update RLS policy for guests to include property-based filtering
DROP POLICY IF EXISTS "Secure guest access by role and property" ON public.guests;

CREATE POLICY "Secure guest access by role and property" 
ON public.guests 
FOR SELECT 
USING (
  is_admin() OR is_manager() OR 
  (is_front_desk() AND (
    -- Guest belongs to a property the user has access to
    (property_id IS NOT NULL AND (
      EXISTS (
        SELECT 1 FROM user_property_access upa
        WHERE upa.user_id = auth.uid() AND upa.property_id = guests.property_id
      )
      OR NOT EXISTS (
        SELECT 1 FROM user_property_access WHERE user_id = auth.uid()
      )
    ))
    OR
    -- Fallback for guests without property_id - check via bookings
    (property_id IS NULL AND EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.guest_id = guests.id
      AND (
        EXISTS (
          SELECT 1 FROM user_property_access upa
          WHERE upa.user_id = auth.uid() AND upa.property_id = b.property_id
        )
        OR NOT EXISTS (
          SELECT 1 FROM user_property_access WHERE user_id = auth.uid()
        )
      )
    ))
  ))
);
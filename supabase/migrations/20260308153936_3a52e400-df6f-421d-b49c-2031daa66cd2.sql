-- Fix: Allow front_desk (write staff) to update rooms for housekeeping transitions
DROP POLICY IF EXISTS "Admin/Manager can update rooms" ON public.rooms;
CREATE POLICY "Write staff can update rooms" ON public.rooms
  FOR UPDATE TO authenticated
  USING (is_write_staff());

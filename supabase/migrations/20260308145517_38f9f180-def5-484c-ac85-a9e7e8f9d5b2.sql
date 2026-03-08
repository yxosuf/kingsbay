
-- Guest feedback table
CREATE TABLE public.guest_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  categories JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (booking_id)
);

-- Enable RLS
ALTER TABLE public.guest_feedback ENABLE ROW LEVEL SECURITY;

-- Staff can view all feedback
CREATE POLICY "Staff can view all feedback"
  ON public.guest_feedback FOR SELECT
  TO authenticated
  USING (is_staff());

-- Write staff can insert feedback
CREATE POLICY "Write staff can insert feedback"
  ON public.guest_feedback FOR INSERT
  TO authenticated
  WITH CHECK (is_write_staff());

-- Write staff can update feedback
CREATE POLICY "Write staff can update feedback"
  ON public.guest_feedback FOR UPDATE
  TO authenticated
  USING (is_write_staff());

-- Admin can delete feedback
CREATE POLICY "Admin can delete feedback"
  ON public.guest_feedback FOR DELETE
  TO authenticated
  USING (is_admin());

-- Updated_at trigger
CREATE TRIGGER update_guest_feedback_updated_at
  BEFORE UPDATE ON public.guest_feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create notifications table for in-app alerts
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID REFERENCES public.properties(id),
  user_id UUID,
  type TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Staff can view notifications for their properties
CREATE POLICY "Staff can view notifications for their properties"
ON public.notifications FOR SELECT
USING (
  public.is_staff() AND (
    property_id IS NULL 
    OR EXISTS (
      SELECT 1 FROM public.user_property_access 
      WHERE user_id = auth.uid() AND property_id = notifications.property_id
    )
  )
);

-- Staff can mark notifications as read
CREATE POLICY "Staff can update their notifications"
ON public.notifications FOR UPDATE
USING (public.is_staff())
WITH CHECK (public.is_staff());

-- System can create notifications (service role)
CREATE POLICY "Service role can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (true);
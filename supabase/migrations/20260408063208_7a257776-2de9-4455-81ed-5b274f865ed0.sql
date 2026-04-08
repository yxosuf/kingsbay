
-- 1. Create the template table
CREATE TABLE public.housekeeping_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
    frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    sort_order INT DEFAULT 0,
    requires_photo BOOLEAN DEFAULT FALSE,
    notify_role TEXT[] DEFAULT '{}',
    inventory_item TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create the task instance table
CREATE TABLE public.housekeeping_task_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checklist_id UUID NOT NULL REFERENCES public.housekeeping_checklists(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    period_date DATE NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
    assigned_to UUID,
    completed_by UUID,
    completed_at TIMESTAMPTZ,
    photo_path TEXT,
    notes TEXT,
    urgency_level INT DEFAULT 1 CHECK (urgency_level BETWEEN 1 AND 3),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE public.housekeeping_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.housekeeping_task_instances ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for housekeeping_checklists
CREATE POLICY "Staff can view housekeeping checklists"
ON public.housekeeping_checklists FOR SELECT
TO authenticated
USING (public.is_staff());

CREATE POLICY "Admin can insert housekeeping checklists"
ON public.housekeeping_checklists FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Admin can update housekeeping checklists"
ON public.housekeeping_checklists FOR UPDATE
TO authenticated
USING (public.is_admin());

CREATE POLICY "Admin can delete housekeeping checklists"
ON public.housekeeping_checklists FOR DELETE
TO authenticated
USING (public.is_admin());

-- 5. RLS Policies for housekeeping_task_instances
CREATE POLICY "Staff can view housekeeping tasks"
ON public.housekeeping_task_instances FOR SELECT
TO authenticated
USING (public.is_staff());

CREATE POLICY "Write staff can insert housekeeping tasks"
ON public.housekeeping_task_instances FOR INSERT
TO authenticated
WITH CHECK (public.is_write_staff());

CREATE POLICY "Write staff can update housekeeping tasks"
ON public.housekeeping_task_instances FOR UPDATE
TO authenticated
USING (public.is_write_staff());

CREATE POLICY "Admin can delete housekeeping tasks"
ON public.housekeeping_task_instances FOR DELETE
TO authenticated
USING (public.is_admin());

-- 6. Performance Indexes
CREATE INDEX idx_hk_instances_property ON public.housekeeping_task_instances(property_id);
CREATE INDEX idx_hk_instances_period ON public.housekeeping_task_instances(period_date);
CREATE INDEX idx_hk_instances_status ON public.housekeeping_task_instances(status);
CREATE INDEX idx_hk_instances_composite ON public.housekeeping_task_instances(property_id, period_date, status);
CREATE INDEX idx_hk_checklists_property ON public.housekeeping_checklists(property_id);

-- 7. Storage bucket for proof photos
INSERT INTO storage.buckets (id, name, public) VALUES ('housekeeping-photos', 'housekeeping-photos', false);

CREATE POLICY "Staff can view housekeeping photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'housekeeping-photos' AND public.is_staff());

CREATE POLICY "Write staff can upload housekeeping photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'housekeeping-photos' AND public.is_write_staff());

CREATE POLICY "Admin can delete housekeeping photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'housekeeping-photos' AND public.is_admin());

-- 8. Enable realtime for task instances
ALTER PUBLICATION supabase_realtime ADD TABLE public.housekeeping_task_instances;

-- 9. Seed default checklist templates (property_id NULL = global templates)
INSERT INTO public.housekeeping_checklists (frequency, category, title, description, sort_order, requires_photo, notify_role, inventory_item) VALUES
-- DAILY: Entrance & Curb Appeal
('daily', 'entrance', 'Sweep Front Entrance & Parking', 'Sweep the front entrance and parking area thoroughly. (Twice Daily)', 1, false, '{}', NULL),
('daily', 'entrance', 'Water Garden Flowers & Pots', 'Water all garden flowers and floor pots. (Twice Daily)', 2, false, '{}', NULL),
('daily', 'entrance', 'Litter Pick-Up Parking Area', 'Complete a litter pick-up on both sides of the parking area.', 3, false, '{}', NULL),
-- DAILY: The Sparkle Factor
('daily', 'sparkle', 'Polish Jewelry Cupboards', 'Wipe down all jewelry cupboards and polish all jewelry to a high shine.', 4, false, '{}', NULL),
('daily', 'sparkle', 'Clean Mirrors & Display Frames', 'Clean all mirrors, display plates, and picture frames in the lobby.', 5, false, '{}', NULL),
('daily', 'sparkle', 'Wipe Arcade & Electronics', 'Wipe down all arcade products and guest-facing electronics.', 6, false, '{}', NULL),
-- DAILY: Hygiene & Dining
('daily', 'hygiene', 'Wipe Restaurant Surfaces', 'Wipe down all restaurant desks, chairs, and bar surfaces.', 7, false, '{}', NULL),
('daily', 'hygiene', 'Deep Clean Downstairs Toilets', 'Deep clean both downstairs toilets and treat with bleach/scent.', 8, false, '{}', NULL),
('daily', 'hygiene', 'Sanitize Switchboards & Light Boxes', 'Sanitize all switchboards and light boxes in common areas.', 9, false, '{}', NULL),
-- WEEKLY: Internal Deep Clean
('weekly', 'deep_clean', 'Deep Clean Lobby & Staircase', 'Deep clean the lobby, hallway, and staircase (including staircase lights).', 1, false, '{}', NULL),
('weekly', 'deep_clean', 'Wash All Windows', 'Wash all windows IN and OUT for crystal clear views.', 2, false, '{}', NULL),
('weekly', 'deep_clean', 'Deep Clean Guest Rooms & Balconies', 'Deep clean all guest rooms and private balcony areas.', 3, false, '{}', NULL),
-- WEEKLY: Kitchen & Bar
('weekly', 'kitchen', 'Kitchen Pull-Out Deep Clean', 'Move equipment, deep clean the floor, and scrub all surfaces.', 4, false, '{}', NULL),
('weekly', 'kitchen', 'Clean Fridge & Freezer', 'Clean the fridge and freezer (Inside & Out).', 5, false, '{}', NULL),
('weekly', 'kitchen', 'Bar Reset & Deep Clean', 'Pull all under-counter items and deep clean the bar flooring.', 6, false, '{}', NULL),
-- WEEKLY: Organization
('weekly', 'organization', 'Tidy Stock Room & Rooftop', 'Tidy the stock room and clean/organize the rooftop area.', 7, false, '{}', NULL),
('weekly', 'organization', 'Organize Cleaning Cupboard', 'Re-organize the cleaning cupboard—hang all tools neatly in order.', 8, false, '{}', NULL),
-- MONTHLY: Mechanical (The Grease Run)
('monthly', 'mechanical', 'Grease Door Hinges & Tracks', 'Grease all door hinges, fridge/freezer metals, and window tracks.', 1, true, ARRAY['admin','manager'], NULL),
('monthly', 'mechanical', 'A/C Unit Maintenance', 'Wipe down all A/C units and grease internal mechanical parts.', 2, true, ARRAY['admin','manager'], NULL),
('monthly', 'mechanical', 'Garden Hardware Check', 'Check all garden bulbs, nails, and grease any outdoor fixtures.', 3, true, ARRAY['admin','manager'], NULL),
-- MONTHLY: Aesthetics (Paint & Polish)
('monthly', 'aesthetics', 'Paint Parking Chains & Poles', 'Paint the front parking chains and poles.', 4, true, ARRAY['admin','manager'], NULL),
('monthly', 'aesthetics', 'Paint Garden Vases & Pots', 'Paint all floor vases, pots, and the bar''s white fence.', 5, true, ARRAY['admin','manager'], NULL),
('monthly', 'aesthetics', 'Wall Touch-ups', 'Identify any black/discolored areas and repaint as necessary.', 6, true, ARRAY['admin','manager'], NULL),
-- MONTHLY: Electrical & Safety
('monthly', 'electrical', 'Clean Ceiling Fans & Light Shades', 'Wipe down all ceiling fans, light shades, and bulbs.', 7, true, '{}', NULL),
('monthly', 'electrical', 'Replace Burnt-Out Bulbs', 'Replace any burnt-out bulbs immediately.', 8, true, ARRAY['admin','manager'], 'bulb'),
('monthly', 'electrical', 'Inspect Beach Beds', 'Inspect all beach beds; hammer in loose nails and paint if weathered.', 9, true, ARRAY['admin','manager'], NULL),
-- DAILY: Additional common tasks
('daily', 'hygiene', 'Sanitize Guest Room High-Touch Points', 'Sanitize door handles, light switches, remotes, and phone in all rooms.', 10, false, '{}', NULL),
('daily', 'entrance', 'Check Outdoor Lighting', 'Ensure all outdoor pathway and garden lights are functional.', 11, false, '{}', NULL),
('daily', 'sparkle', 'Dust Reception Desk & Lobby Furniture', 'Dust and wipe all reception surfaces and lobby seating.', 12, false, '{}', NULL),
-- WEEKLY: Additional
('weekly', 'deep_clean', 'Laundry Room Deep Clean', 'Clean washing machines, dryers, ironing area, and floor.', 9, false, '{}', NULL),
('weekly', 'deep_clean', 'Pool Area Maintenance', 'Clean pool deck, arrange sun loungers, check umbrellas.', 10, false, '{}', NULL);

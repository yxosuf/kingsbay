
-- 1. Add 'viewer' to staff_role enum (must be committed alone before referencing)
ALTER TYPE public.staff_role ADD VALUE IF NOT EXISTS 'viewer';


-- Step 1: Add is_hidden column and new enum values only
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;

-- Add new enum values
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'checker';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'driver';

-- Step 1: Add new roles to the app_role enum only
-- These must be committed first before being used in functions

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'approval_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'logistics_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'project_engineer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'receiver';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'tracking_driver';
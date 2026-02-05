-- Add new roles: office_admin and warehouse_admin
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'office_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'warehouse_admin';
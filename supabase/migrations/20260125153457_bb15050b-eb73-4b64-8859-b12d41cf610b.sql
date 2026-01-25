-- Add 'deleted' status to project_status enum
ALTER TYPE project_status ADD VALUE IF NOT EXISTS 'deleted';

-- Add 'approver' role to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'approver';
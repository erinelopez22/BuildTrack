
-- Update has_project_access to include office_admin as having global access (like admin)
CREATE OR REPLACE FUNCTION public.has_project_access(_user_id uuid, _project_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT 
    public.is_admin(_user_id) 
    OR public.is_office_admin(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.project_members
      WHERE user_id = _user_id
        AND project_id = _project_id
    )
$$;

-- Update is_office_admin to NOT include admin/super_admin (keep it pure)
-- Actually the current one is correct - it only checks for office_admin role
-- We need to make is_office_admin a pure check (no admin fallback)
CREATE OR REPLACE FUNCTION public.is_office_admin(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'office_admin'
  )
$$;

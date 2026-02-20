
-- Create a SECURITY DEFINER RPC to atomically create a project and add the creator as a member
CREATE OR REPLACE FUNCTION public.create_project_with_membership(
  _name text,
  _description text DEFAULT NULL,
  _location text DEFAULT NULL,
  _start_date date DEFAULT NULL,
  _end_date date DEFAULT NULL,
  _status project_status DEFAULT 'active'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _new_project_id uuid;
  _user_role app_role;
BEGIN
  _user_id := auth.uid();
  
  -- Check the user can create projects (admin, super_admin, or project_engineer)
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'admin', 'project_engineer')
  ) THEN
    RAISE EXCEPTION 'Permission denied: you cannot create projects';
  END IF;

  -- Insert the project
  INSERT INTO public.projects (name, description, location, start_date, end_date, status, created_by)
  VALUES (_name, _description, _location, _start_date, _end_date, _status, _user_id)
  RETURNING id INTO _new_project_id;

  -- Get the user's highest role for membership
  SELECT role INTO _user_role
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY
    CASE role
      WHEN 'super_admin' THEN 1
      WHEN 'admin' THEN 2
      WHEN 'project_engineer' THEN 3
      ELSE 10
    END
  LIMIT 1;

  -- Auto-add the creator as a project member (only for project_engineer)
  IF _user_role = 'project_engineer' THEN
    INSERT INTO public.project_members (project_id, user_id, role, created_by)
    VALUES (_new_project_id, _user_id, 'project_engineer', _user_id);
  END IF;

  RETURN _new_project_id;
END;
$$;

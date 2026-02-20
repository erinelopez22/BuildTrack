
-- Create a SECURITY DEFINER RPC for adding project members
-- This bypasses the admin-only RLS on project_members for INSERT
CREATE OR REPLACE FUNCTION public.add_project_member(
  p_project_id uuid,
  p_user_id uuid,
  p_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller_role app_role;
  _is_admin boolean;
  _is_project_member boolean;
  _allowed_roles constant text[] := ARRAY['project_engineer', 'checker', 'office_admin', 'warehouse_admin', 'viewer'];
BEGIN
  -- Check if caller is admin/super_admin
  _is_admin := public.is_admin(auth.uid());

  IF NOT _is_admin THEN
    -- Check if caller has project_engineer or office_admin role
    IF NOT (public.has_role(auth.uid(), 'project_engineer') OR public.has_role(auth.uid(), 'office_admin')) THEN
      RAISE EXCEPTION 'Permission denied: You do not have permission to add project members.';
    END IF;

    -- Non-admin callers must be a member of the project
    SELECT EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = p_project_id AND user_id = auth.uid()
    ) INTO _is_project_member;

    IF NOT _is_project_member THEN
      RAISE EXCEPTION 'Permission denied: You can only add members to projects you are a member of.';
    END IF;
  END IF;

  -- Validate the role being assigned
  IF NOT (p_role = ANY(_allowed_roles)) THEN
    RAISE EXCEPTION 'Permission denied: The role "%" cannot be assigned via team management.', p_role;
  END IF;

  -- Check for duplicate membership
  IF EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = p_project_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'This user is already a member of this project.';
  END IF;

  -- Insert the new project member
  INSERT INTO public.project_members (project_id, user_id, role, created_by)
  VALUES (p_project_id, p_user_id, p_role::app_role, auth.uid());
END;
$$;

-- Grant execute to authenticated users only
REVOKE EXECUTE ON FUNCTION public.add_project_member FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_project_member TO authenticated;

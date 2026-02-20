
-- Step 2: Update all security functions to use new roles

-- Update can_create_orders
CREATE OR REPLACE FUNCTION public.can_create_orders(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'admin', 'project_engineer')
  )
$$;

-- Update can_approve_orders
CREATE OR REPLACE FUNCTION public.can_approve_orders(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'admin', 'office_admin')
  )
$$;

-- Update can_submit_orders
CREATE OR REPLACE FUNCTION public.can_submit_orders(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'admin', 'office_admin')
  )
$$;

-- Update can_process_logistics
CREATE OR REPLACE FUNCTION public.can_process_logistics(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'admin', 'warehouse_admin')
  )
$$;

-- Update can_receive_orders
CREATE OR REPLACE FUNCTION public.can_receive_orders(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'admin', 'project_engineer', 'checker')
  )
$$;

-- Update is_office_admin
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

-- Update is_warehouse_admin
CREATE OR REPLACE FUNCTION public.is_warehouse_admin(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'warehouse_admin'
  )
$$;

-- Update can_transition_order_status
CREATE OR REPLACE FUNCTION public.can_transition_order_status(_user_id uuid, _from_status order_status, _to_status order_status)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  user_role app_role;
BEGIN
  SELECT role INTO user_role
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY 
    CASE role
      WHEN 'super_admin' THEN 1
      WHEN 'admin' THEN 2
      WHEN 'office_admin' THEN 3
      WHEN 'warehouse_admin' THEN 4
      WHEN 'project_engineer' THEN 5
      WHEN 'checker' THEN 6
      WHEN 'viewer' THEN 8
      WHEN 'driver' THEN 9
      ELSE 10
    END
  LIMIT 1;

  IF user_role = 'super_admin' THEN RETURN TRUE; END IF;
  IF user_role = 'admin' THEN RETURN TRUE; END IF;

  IF user_role = 'office_admin' THEN
    IF (_from_status = 'for_approval' AND _to_status IN ('approved', 'rejected')) THEN RETURN TRUE; END IF;
    IF (_from_status = 'approved' AND _to_status IN ('submitted', 'ordered')) THEN RETURN TRUE; END IF;
    IF _to_status = 'on_hold' AND _from_status IN ('for_approval', 'approved') THEN RETURN TRUE; END IF;
    RETURN FALSE;
  END IF;

  IF user_role = 'warehouse_admin' THEN
    IF (_from_status IN ('submitted', 'ordered', 'approved') AND _to_status = 'preparing') THEN RETURN TRUE; END IF;
    IF (_from_status = 'preparing' AND _to_status = 'in_transit') THEN RETURN TRUE; END IF;
    IF _to_status = 'on_hold' AND _from_status = 'preparing' THEN RETURN TRUE; END IF;
    RETURN FALSE;
  END IF;

  IF user_role = 'project_engineer' THEN
    IF (_from_status = 'in_transit' AND _to_status = 'delivered') THEN RETURN TRUE; END IF;
    IF (_from_status = 'in_transit' AND _to_status = 'on_hold') THEN RETURN TRUE; END IF;
    RETURN FALSE;
  END IF;

  IF user_role = 'checker' THEN
    IF (_from_status = 'in_transit' AND _to_status = 'delivered') THEN RETURN TRUE; END IF;
    IF (_from_status = 'in_transit' AND _to_status = 'on_hold') THEN RETURN TRUE; END IF;
    RETURN FALSE;
  END IF;

  RETURN FALSE;
END;
$$;

-- Add is_checker function
CREATE OR REPLACE FUNCTION public.is_checker(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'checker'
  )
$$;

-- Update isApprover to only include office_admin
CREATE OR REPLACE FUNCTION public.is_approver(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('office_admin', 'admin', 'super_admin')
  )
$$;

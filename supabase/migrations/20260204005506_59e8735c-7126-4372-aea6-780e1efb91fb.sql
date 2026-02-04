-- Step 2: Create permission-checking functions for the new role system

-- Function to check if user can create orders
CREATE OR REPLACE FUNCTION public.can_create_orders(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'admin', 'project_engineer', 'project_manager', 'procurement', 'site_lead')
  )
$$;

-- Function to check if user can approve/reject orders
CREATE OR REPLACE FUNCTION public.can_approve_orders(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'admin', 'approval_admin', 'approver')
  )
$$;

-- Function to check if user can process orders to "ordered/submitted"
CREATE OR REPLACE FUNCTION public.can_submit_orders(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'admin', 'approval_admin')
  )
$$;

-- Function to check if user can process logistics (preparing, in_transit)
CREATE OR REPLACE FUNCTION public.can_process_logistics(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'admin', 'logistics_admin')
  )
$$;

-- Function to check if user can mark orders as delivered
CREATE OR REPLACE FUNCTION public.can_receive_orders(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('super_admin', 'admin', 'project_engineer', 'project_manager', 'site_lead', 'receiver', 'storekeeper')
  )
$$;

-- Function to check if user can manage user roles (Super Admin only)
CREATE OR REPLACE FUNCTION public.can_manage_roles(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'super_admin'
  )
$$;

-- Comprehensive function to check order status transition permission
CREATE OR REPLACE FUNCTION public.can_transition_order_status(
  _user_id uuid,
  _from_status order_status,
  _to_status order_status
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role app_role;
BEGIN
  -- Get user's highest role
  SELECT role INTO user_role
  FROM public.user_roles
  WHERE user_id = _user_id
  ORDER BY 
    CASE role
      WHEN 'super_admin' THEN 1
      WHEN 'admin' THEN 2
      WHEN 'approval_admin' THEN 3
      WHEN 'logistics_admin' THEN 4
      WHEN 'project_engineer' THEN 5
      WHEN 'project_manager' THEN 5
      WHEN 'receiver' THEN 6
      WHEN 'storekeeper' THEN 6
      WHEN 'site_lead' THEN 6
      WHEN 'procurement' THEN 7
      WHEN 'tracking_driver' THEN 8
      WHEN 'viewer' THEN 9
      ELSE 10
    END
  LIMIT 1;

  -- Super Admin and Admin can do anything
  IF user_role IN ('super_admin', 'admin') THEN
    RETURN TRUE;
  END IF;

  -- Approval Admin: for_approval → approved/rejected, approved → submitted/ordered
  IF user_role = 'approval_admin' THEN
    IF (_from_status = 'for_approval' AND _to_status IN ('approved', 'rejected')) THEN
      RETURN TRUE;
    END IF;
    IF (_from_status = 'approved' AND _to_status IN ('submitted', 'ordered')) THEN
      RETURN TRUE;
    END IF;
    RETURN FALSE;
  END IF;

  -- Logistics Admin: submitted/ordered → preparing, preparing → in_transit
  IF user_role = 'logistics_admin' THEN
    IF (_from_status IN ('submitted', 'ordered') AND _to_status = 'preparing') THEN
      RETURN TRUE;
    END IF;
    IF (_from_status = 'preparing' AND _to_status = 'in_transit') THEN
      RETURN TRUE;
    END IF;
    RETURN FALSE;
  END IF;

  -- Project Engineer / Project Manager / Site Lead: in_transit → delivered
  IF user_role IN ('project_engineer', 'project_manager', 'site_lead') THEN
    IF (_from_status = 'in_transit' AND _to_status = 'delivered') THEN
      RETURN TRUE;
    END IF;
    RETURN FALSE;
  END IF;

  -- Receiver / Storekeeper: in_transit → delivered
  IF user_role IN ('receiver', 'storekeeper') THEN
    IF (_from_status = 'in_transit' AND _to_status = 'delivered') THEN
      RETURN TRUE;
    END IF;
    RETURN FALSE;
  END IF;

  -- Approver (legacy): can approve/reject
  IF user_role = 'approver' THEN
    IF (_from_status = 'for_approval' AND _to_status IN ('approved', 'rejected')) THEN
      RETURN TRUE;
    END IF;
    RETURN FALSE;
  END IF;

  -- All others (tracking_driver, viewer, procurement): no transitions allowed
  RETURN FALSE;
END;
$$;
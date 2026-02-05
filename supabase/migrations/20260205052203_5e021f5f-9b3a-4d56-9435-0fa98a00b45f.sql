-- Update permission functions according to new role definitions

-- 1. can_create_orders: Only super_admin, admin, project_engineer can create orders
-- Office Admin, Warehouse Admin, Receiver, Tracking Driver, Viewer CANNOT create orders
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
      AND role IN ('super_admin', 'admin', 'project_engineer', 'project_manager', 'site_lead')
  )
$$;

-- 2. can_approve_orders: super_admin, admin, office_admin can approve/reject
-- Warehouse Admin, Project Engineer, Receiver, Tracking Driver, Viewer CANNOT approve
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
      AND role IN ('super_admin', 'admin', 'office_admin', 'approval_admin', 'approver')
  )
$$;

-- 3. can_submit_orders: super_admin, admin, office_admin can move approved → submitted/ordered
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
      AND role IN ('super_admin', 'admin', 'office_admin', 'approval_admin')
  )
$$;

-- 4. can_process_logistics: super_admin, admin, warehouse_admin can process orders (preparing → in_transit)
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
      AND role IN ('super_admin', 'admin', 'warehouse_admin', 'logistics_admin')
  )
$$;

-- 5. can_receive_orders: super_admin, admin, project_engineer, receiver can mark as delivered
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

-- 6. can_manage_roles: Only super_admin can manage roles
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

-- 7. can_transition_order_status: Comprehensive role-based status transition rules
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
      WHEN 'office_admin' THEN 3
      WHEN 'warehouse_admin' THEN 4
      WHEN 'project_engineer' THEN 5
      WHEN 'project_manager' THEN 5
      WHEN 'receiver' THEN 6
      WHEN 'storekeeper' THEN 6
      WHEN 'site_lead' THEN 6
      WHEN 'tracking_driver' THEN 7
      WHEN 'viewer' THEN 8
      -- Legacy roles
      WHEN 'approval_admin' THEN 3
      WHEN 'logistics_admin' THEN 4
      WHEN 'approver' THEN 3
      WHEN 'procurement' THEN 7
      ELSE 10
    END
  LIMIT 1;

  -- Super Admin can do anything (override all statuses)
  IF user_role = 'super_admin' THEN
    RETURN TRUE;
  END IF;

  -- Admin can do almost anything except override super admin
  IF user_role = 'admin' THEN
    RETURN TRUE;
  END IF;

  -- Office Admin (or legacy approval_admin/approver): 
  -- Can approve/reject order requests, cannot create orders, cannot move beyond approved
  IF user_role IN ('office_admin', 'approval_admin', 'approver') THEN
    -- Can approve or reject order requests
    IF (_from_status = 'for_approval' AND _to_status IN ('approved', 'rejected')) THEN
      RETURN TRUE;
    END IF;
    -- Can move approved to submitted/ordered
    IF (_from_status = 'approved' AND _to_status IN ('submitted', 'ordered')) THEN
      RETURN TRUE;
    END IF;
    -- Can put orders on hold
    IF _to_status = 'on_hold' AND _from_status IN ('for_approval', 'approved') THEN
      RETURN TRUE;
    END IF;
    RETURN FALSE;
  END IF;

  -- Warehouse Admin (or legacy logistics_admin): 
  -- Can process ordered → preparing and preparing → in_transit
  IF user_role IN ('warehouse_admin', 'logistics_admin') THEN
    IF (_from_status IN ('submitted', 'ordered', 'approved') AND _to_status = 'preparing') THEN
      RETURN TRUE;
    END IF;
    IF (_from_status = 'preparing' AND _to_status = 'in_transit') THEN
      RETURN TRUE;
    END IF;
    -- Can put orders on hold
    IF _to_status = 'on_hold' AND _from_status IN ('preparing') THEN
      RETURN TRUE;
    END IF;
    RETURN FALSE;
  END IF;

  -- Project Engineer / Project Manager / Site Lead: 
  -- Can move in_transit → delivered
  IF user_role IN ('project_engineer', 'project_manager', 'site_lead') THEN
    IF (_from_status = 'in_transit' AND _to_status = 'delivered') THEN
      RETURN TRUE;
    END IF;
    RETURN FALSE;
  END IF;

  -- Receiver / Storekeeper: 
  -- Can only mark orders as delivered from in_transit
  IF user_role IN ('receiver', 'storekeeper') THEN
    IF (_from_status = 'in_transit' AND _to_status = 'delivered') THEN
      RETURN TRUE;
    END IF;
    RETURN FALSE;
  END IF;

  -- Tracking Driver: View-only, no transitions allowed
  IF user_role = 'tracking_driver' THEN
    RETURN FALSE;
  END IF;

  -- Viewer: View-only, no transitions allowed
  IF user_role = 'viewer' THEN
    RETURN FALSE;
  END IF;

  -- All others (procurement, etc.): no transitions allowed
  RETURN FALSE;
END;
$$;

-- 8. Add function to check if user is office_admin
CREATE OR REPLACE FUNCTION public.is_office_admin(_user_id uuid)
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
      AND role IN ('office_admin', 'approval_admin')
  )
$$;

-- 9. Add function to check if user is warehouse_admin
CREATE OR REPLACE FUNCTION public.is_warehouse_admin(_user_id uuid)
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
      AND role IN ('warehouse_admin', 'logistics_admin')
  )
$$;
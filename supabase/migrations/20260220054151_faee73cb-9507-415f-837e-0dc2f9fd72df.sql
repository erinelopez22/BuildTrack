
-- Update can_transition_order_status to block warehouse_admin from on_hold
CREATE OR REPLACE FUNCTION public.can_transition_order_status(_user_id uuid, _from_status order_status, _to_status order_status)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Trucking Admin (warehouse_admin): CANNOT set on_hold or resume from on_hold
  IF user_role = 'warehouse_admin' THEN
    IF (_from_status IN ('submitted', 'ordered', 'approved') AND _to_status = 'preparing') THEN RETURN TRUE; END IF;
    IF (_from_status = 'preparing' AND _to_status = 'in_transit') THEN RETURN TRUE; END IF;
    -- Explicitly block on_hold and resume
    IF _to_status = 'on_hold' THEN RETURN FALSE; END IF;
    IF _from_status = 'on_hold' THEN RETURN FALSE; END IF;
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
$function$;

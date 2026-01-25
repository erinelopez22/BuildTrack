
-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;

-- Create a new policy that allows project members to view audit logs for their projects
CREATE POLICY "Users can view project audit logs"
ON public.audit_logs
FOR SELECT
USING (
  -- Admins can see all logs
  is_admin(auth.uid())
  OR
  -- For order-related logs, check project access through the order
  (table_name = 'orders' AND EXISTS (
    SELECT 1 FROM orders o 
    WHERE o.id::text = record_id::text 
    AND has_project_access(auth.uid(), o.project_id)
  ))
  OR
  -- For project_members logs, check project access
  (table_name = 'project_members' AND EXISTS (
    SELECT 1 FROM project_members pm 
    WHERE pm.id::text = record_id::text 
    AND has_project_access(auth.uid(), pm.project_id)
  ))
  OR
  -- For project_inventory logs, check project access
  (table_name = 'project_inventory' AND EXISTS (
    SELECT 1 FROM project_inventory pi 
    WHERE pi.id::text = record_id::text 
    AND has_project_access(auth.uid(), pi.project_id)
  ))
  OR
  -- For projects logs, check project access
  (table_name = 'projects' AND has_project_access(auth.uid(), record_id))
);

-- Also update insert policy to allow any authenticated user to insert logs
DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.audit_logs;

CREATE POLICY "Authenticated users can insert audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

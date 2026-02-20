
-- =============================================
-- 1) project_members: Allow PE/Office Admin to DELETE (scoped to their projects)
-- =============================================
-- Drop existing restrictive delete (admin-only via ALL policy already handles admin)
-- Add explicit DELETE + UPDATE policies for PE and Office Admin

CREATE POLICY "PE and Office Admin can delete project members"
ON public.project_members
FOR DELETE
USING (
  public.has_role(auth.uid(), 'project_engineer') AND EXISTS (
    SELECT 1 FROM public.project_members pm WHERE pm.project_id = project_members.project_id AND pm.user_id = auth.uid()
  )
  OR
  public.has_role(auth.uid(), 'office_admin') AND EXISTS (
    SELECT 1 FROM public.project_members pm WHERE pm.project_id = project_members.project_id AND pm.user_id = auth.uid()
  )
);

CREATE POLICY "PE and Office Admin can update project members"
ON public.project_members
FOR UPDATE
USING (
  public.has_role(auth.uid(), 'project_engineer') AND EXISTS (
    SELECT 1 FROM public.project_members pm WHERE pm.project_id = project_members.project_id AND pm.user_id = auth.uid()
  )
  OR
  public.has_role(auth.uid(), 'office_admin') AND EXISTS (
    SELECT 1 FROM public.project_members pm WHERE pm.project_id = project_members.project_id AND pm.user_id = auth.uid()
  )
);

-- =============================================
-- 2) quotation_change_requests: Allow Office Admin to UPDATE (approve/reject)
-- =============================================
CREATE POLICY "Office Admin can update change requests"
ON public.quotation_change_requests
FOR UPDATE
USING (public.is_office_admin(auth.uid()));

-- =============================================
-- 3) project_quotations: Allow Office Admin full management for approval flow
-- =============================================
CREATE POLICY "Office Admin can insert quotations"
ON public.project_quotations
FOR INSERT
WITH CHECK (public.is_office_admin(auth.uid()));

CREATE POLICY "Office Admin can update quotations"
ON public.project_quotations
FOR UPDATE
USING (public.is_office_admin(auth.uid()));

CREATE POLICY "Office Admin can delete quotations"
ON public.project_quotations
FOR DELETE
USING (public.is_office_admin(auth.uid()));

-- =============================================
-- 4) quotation_items: Allow Office Admin to manage items during approval
-- =============================================
CREATE POLICY "Office Admin can insert quotation items"
ON public.quotation_items
FOR INSERT
WITH CHECK (public.is_office_admin(auth.uid()));

CREATE POLICY "Office Admin can update quotation items"
ON public.quotation_items
FOR UPDATE
USING (public.is_office_admin(auth.uid()));

CREATE POLICY "Office Admin can delete quotation items"
ON public.quotation_items
FOR DELETE
USING (public.is_office_admin(auth.uid()));

-- =============================================
-- 5) SKUs: Allow order creators (PE) to insert SKUs when creating orders
-- =============================================
CREATE POLICY "Order creators can insert SKUs"
ON public.skus
FOR INSERT
WITH CHECK (public.can_create_orders(auth.uid()));

-- =============================================
-- 6) Orders + related: Allow PE to delete rejected orders
--    (orders ALL policy already covers PE via has_project_access,
--     but related tables need explicit delete for non-admin roles)
-- =============================================

-- order_evidence: Allow PE and Office Admin to delete
CREATE POLICY "PE and Office Admin can delete order evidence"
ON public.order_evidence
FOR DELETE
USING (
  has_project_access(auth.uid(), project_id)
  AND (public.can_create_orders(auth.uid()) OR public.is_office_admin(auth.uid()))
);

-- order_tracking_assignments: Allow PE and Office Admin to delete
CREATE POLICY "PE and Office Admin can delete tracking assignments"
ON public.order_tracking_assignments
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM orders o WHERE o.id = order_tracking_assignments.order_id AND has_project_access(auth.uid(), o.project_id)
  )
  AND (public.can_create_orders(auth.uid()) OR public.is_office_admin(auth.uid()))
);

-- order_tracking_evidence: Allow PE and Office Admin to delete
CREATE POLICY "PE and Office Admin can delete tracking evidence"
ON public.order_tracking_evidence
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM order_tracking_assignments ota
    JOIN orders o ON o.id = ota.order_id
    WHERE ota.id = order_tracking_evidence.order_tracking_assignment_id
    AND has_project_access(auth.uid(), o.project_id)
  )
  AND (public.can_create_orders(auth.uid()) OR public.is_office_admin(auth.uid()))
);

-- tracking_driver_materials: Allow PE and Office Admin to delete
CREATE POLICY "PE and Office Admin can delete tracking materials"
ON public.tracking_driver_materials
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM order_tracking_assignments ota
    JOIN orders o ON o.id = ota.order_id
    WHERE ota.id = tracking_driver_materials.tracking_assignment_id
    AND has_project_access(auth.uid(), o.project_id)
  )
  AND (public.can_create_orders(auth.uid()) OR public.is_office_admin(auth.uid()))
);

-- receiver_evidence: Allow PE and Office Admin to delete
CREATE POLICY "PE and Office Admin can delete receiver evidence"
ON public.receiver_evidence
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM order_tracking_assignments ota
    JOIN orders o ON o.id = ota.order_id
    WHERE ota.id = receiver_evidence.order_tracking_assignment_id
    AND has_project_access(auth.uid(), o.project_id)
  )
  AND (public.can_create_orders(auth.uid()) OR public.is_office_admin(auth.uid()))
);

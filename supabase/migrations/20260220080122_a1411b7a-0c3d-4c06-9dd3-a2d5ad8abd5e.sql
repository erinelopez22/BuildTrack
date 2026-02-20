-- Allow Project Engineers and Checkers to update order_tracking_assignments
-- (needed for Track Arrived, Hold, Resume actions during in_transit → delivered flow)
CREATE POLICY "PE and Checker can update tracking assignments"
ON public.order_tracking_assignments
FOR UPDATE
USING (
  (EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_tracking_assignments.order_id
    AND has_project_access(auth.uid(), o.project_id)
  ))
  AND (
    has_role(auth.uid(), 'project_engineer'::app_role)
    OR has_role(auth.uid(), 'checker'::app_role)
  )
);
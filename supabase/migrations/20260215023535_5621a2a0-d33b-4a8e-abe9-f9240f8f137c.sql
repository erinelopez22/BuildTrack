
-- Create tracking_driver_materials table for material assignment per driver
CREATE TABLE public.tracking_driver_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_assignment_id uuid NOT NULL REFERENCES public.order_tracking_assignments(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  assigned_quantity integer NOT NULL CHECK (assigned_quantity > 0),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tracking_driver_materials ENABLE ROW LEVEL SECURITY;

-- View policy: users with project access can view
CREATE POLICY "Users can view tracking materials for accessible orders"
ON public.tracking_driver_materials
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM order_tracking_assignments ota
    JOIN orders o ON o.id = ota.order_id
    WHERE ota.id = tracking_driver_materials.tracking_assignment_id
    AND has_project_access(auth.uid(), o.project_id)
  )
);

-- Manage policy: admins and logistics users can manage
CREATE POLICY "Authorized users can manage tracking materials"
ON public.tracking_driver_materials
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM order_tracking_assignments ota
    JOIN orders o ON o.id = ota.order_id
    WHERE ota.id = tracking_driver_materials.tracking_assignment_id
    AND has_project_access(auth.uid(), o.project_id)
  )
  AND (is_admin(auth.uid()) OR can_process_logistics(auth.uid()))
);

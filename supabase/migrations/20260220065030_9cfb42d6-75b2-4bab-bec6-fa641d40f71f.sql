-- Allow warehouse_admin (Trucking Admin) to view driver roles for the driver picker
CREATE POLICY "Logistics users can view driver roles"
ON public.user_roles
FOR SELECT
USING (
  can_process_logistics(auth.uid())
  AND role IN ('driver', 'tracking_driver')
);

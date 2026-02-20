
-- Create rejected_orders table with exact same structure as orders
CREATE TABLE public.rejected_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number text NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id),
  created_by uuid NOT NULL,
  status order_status NULL DEFAULT 'rejected'::order_status,
  order_type text NULL DEFAULT 'PO'::text,
  supplier_name text NULL,
  supplier_contact text NULL,
  notes text NULL,
  total_amount numeric NULL,
  expected_delivery_date date NULL,
  approved_by uuid NULL,
  approved_at timestamptz NULL,
  rejected_by uuid NULL,
  rejected_at timestamptz NULL,
  rejection_reason text NULL,
  on_transit_at timestamptz NULL,
  delivered_at timestamptz NULL,
  previous_status text NULL,
  created_at timestamptz NULL DEFAULT now(),
  updated_at timestamptz NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rejected_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view rejected orders for accessible projects"
ON public.rejected_orders
FOR SELECT
USING (has_project_access(auth.uid(), project_id));

CREATE POLICY "Admins can delete rejected orders"
ON public.rejected_orders
FOR DELETE
USING (is_admin(auth.uid()));

CREATE POLICY "System can insert rejected orders via RPC"
ON public.rejected_orders
FOR INSERT
WITH CHECK (true);

-- Create atomic reject_order RPC function
CREATE OR REPLACE FUNCTION public.reject_order(
  _order_id uuid,
  _rejection_reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid;
  _order_exists boolean;
BEGIN
  _user_id := auth.uid();

  -- Verify order exists
  SELECT EXISTS(SELECT 1 FROM public.orders WHERE id = _order_id) INTO _order_exists;
  
  IF NOT _order_exists THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- Check permission: must be able to approve orders (super_admin, admin, office_admin)
  IF NOT public.can_approve_orders(_user_id) AND NOT public.is_admin(_user_id) THEN
    RAISE EXCEPTION 'Permission denied: you cannot reject orders';
  END IF;

  -- Update the order with rejection info first
  UPDATE public.orders SET
    status = 'rejected',
    rejected_by = _user_id,
    rejected_at = now(),
    rejection_reason = _rejection_reason,
    updated_at = now()
  WHERE id = _order_id;

  -- Insert into rejected_orders (copy the full row)
  INSERT INTO public.rejected_orders (
    id, order_number, project_id, created_by, status, order_type,
    supplier_name, supplier_contact, notes, total_amount,
    expected_delivery_date, approved_by, approved_at,
    rejected_by, rejected_at, rejection_reason,
    on_transit_at, delivered_at, previous_status,
    created_at, updated_at
  )
  SELECT
    id, order_number, project_id, created_by, status, order_type,
    supplier_name, supplier_contact, notes, total_amount,
    expected_delivery_date, approved_by, approved_at,
    rejected_by, rejected_at, rejection_reason,
    on_transit_at, delivered_at, previous_status,
    created_at, now()
  FROM public.orders
  WHERE id = _order_id;

  -- Delete from orders table
  DELETE FROM public.orders WHERE id = _order_id;

  RETURN _order_id;
END;
$$;

-- Create function for permanently deleting rejected orders with cascade
CREATE OR REPLACE FUNCTION public.delete_rejected_order(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid;
  _assignment_ids uuid[];
  _delivery_ids uuid[];
BEGIN
  _user_id := auth.uid();

  -- Check permission: only admin/super_admin
  IF NOT public.is_admin(_user_id) THEN
    RAISE EXCEPTION 'Permission denied: only Admin and Super Admin can permanently delete rejected orders';
  END IF;

  -- Gather related assignment IDs
  SELECT array_agg(id) INTO _assignment_ids
  FROM public.order_tracking_assignments
  WHERE order_id = _order_id;

  -- Delete tracking-related records
  IF _assignment_ids IS NOT NULL AND array_length(_assignment_ids, 1) > 0 THEN
    DELETE FROM public.receiver_evidence WHERE order_tracking_assignment_id = ANY(_assignment_ids);
    DELETE FROM public.order_tracking_evidence WHERE order_tracking_assignment_id = ANY(_assignment_ids);
    DELETE FROM public.tracking_driver_materials WHERE tracking_assignment_id = ANY(_assignment_ids);
    DELETE FROM public.order_tracking_assignments WHERE order_id = _order_id;
  END IF;

  -- Delete order evidence
  DELETE FROM public.order_evidence WHERE order_id = _order_id;

  -- Gather delivery IDs
  SELECT array_agg(id) INTO _delivery_ids
  FROM public.deliveries
  WHERE order_id = _order_id;

  -- Delete delivery-related records
  IF _delivery_ids IS NOT NULL AND array_length(_delivery_ids, 1) > 0 THEN
    DELETE FROM public.delivery_items WHERE delivery_id = ANY(_delivery_ids);
    DELETE FROM public.deliveries WHERE order_id = _order_id;
  END IF;

  -- Delete order items
  DELETE FROM public.order_items WHERE order_id = _order_id;

  -- Finally delete from rejected_orders
  DELETE FROM public.rejected_orders WHERE id = _order_id;
END;
$$;

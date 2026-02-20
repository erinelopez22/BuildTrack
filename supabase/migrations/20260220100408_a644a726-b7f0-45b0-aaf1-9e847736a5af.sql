
-- Create rejected_order_items table mirroring order_items
CREATE TABLE public.rejected_order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.rejected_orders(id) ON DELETE CASCADE,
  sku_id uuid NOT NULL REFERENCES public.skus(id),
  quantity_ordered integer NOT NULL,
  quantity_received integer DEFAULT 0,
  quotation_item_id uuid REFERENCES public.quotation_items(id),
  unit_price numeric,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rejected_order_items ENABLE ROW LEVEL SECURITY;

-- RLS: View if user has project access via rejected_orders
CREATE POLICY "Users can view rejected order items"
ON public.rejected_order_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.rejected_orders ro
    WHERE ro.id = rejected_order_items.order_id
    AND has_project_access(auth.uid(), ro.project_id)
  )
);

-- RLS: System insert via RPC
CREATE POLICY "System can insert rejected order items via RPC"
ON public.rejected_order_items
FOR INSERT
WITH CHECK (true);

-- RLS: Admin delete
CREATE POLICY "Admins can delete rejected order items"
ON public.rejected_order_items
FOR DELETE
USING (is_admin(auth.uid()));

-- Update reject_order RPC to also move order_items
CREATE OR REPLACE FUNCTION public.reject_order(_order_id uuid, _rejection_reason text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
  _order_exists boolean;
BEGIN
  _user_id := auth.uid();

  SELECT EXISTS(SELECT 1 FROM public.orders WHERE id = _order_id) INTO _order_exists;
  
  IF NOT _order_exists THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF NOT public.can_approve_orders(_user_id) AND NOT public.is_admin(_user_id) THEN
    RAISE EXCEPTION 'Permission denied: you cannot reject orders';
  END IF;

  -- Update the order with rejection info
  UPDATE public.orders SET
    status = 'rejected',
    rejected_by = _user_id,
    rejected_at = now(),
    rejection_reason = _rejection_reason,
    updated_at = now()
  WHERE id = _order_id;

  -- Copy to rejected_orders
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

  -- Copy order items to rejected_order_items
  INSERT INTO public.rejected_order_items (
    id, order_id, sku_id, quantity_ordered, quantity_received,
    quotation_item_id, unit_price, notes, created_at
  )
  SELECT
    id, order_id, sku_id, quantity_ordered, quantity_received,
    quotation_item_id, unit_price, notes, created_at
  FROM public.order_items
  WHERE order_id = _order_id;

  -- Delete order items from original table
  DELETE FROM public.order_items WHERE order_id = _order_id;

  -- Delete from orders table
  DELETE FROM public.orders WHERE id = _order_id;

  RETURN _order_id;
END;
$function$;

-- Update delete_rejected_order to also delete rejected_order_items
CREATE OR REPLACE FUNCTION public.delete_rejected_order(_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user_id uuid;
  _assignment_ids uuid[];
  _delivery_ids uuid[];
BEGIN
  _user_id := auth.uid();

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

  -- Delete rejected order items (cascade should handle this, but explicit for safety)
  DELETE FROM public.rejected_order_items WHERE order_id = _order_id;

  -- Delete original order items if any remain
  DELETE FROM public.order_items WHERE order_id = _order_id;

  -- Finally delete from rejected_orders
  DELETE FROM public.rejected_orders WHERE id = _order_id;
END;
$function$;

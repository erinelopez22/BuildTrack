
-- Fix: Rename PL/pgSQL variable to avoid ambiguity with column name
CREATE OR REPLACE FUNCTION public.validate_asset_quantity_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_borrowed_qty INTEGER;
BEGIN
  SELECT COALESCE(SUM(bt.borrowed_qty - bt.returned_qty), 0)
  INTO v_borrowed_qty
  FROM public.borrow_transactions bt
  WHERE bt.asset_id = NEW.id AND bt.status != 'Returned';

  IF NEW.total_quantity < v_borrowed_qty THEN
    RAISE EXCEPTION 'Not allowed: Total quantity cannot be lower than currently borrowed quantity (%). Return borrowed items first or set the quantity to at least %.', v_borrowed_qty, v_borrowed_qty;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_asset_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_borrowed_qty INTEGER;
BEGIN
  SELECT COALESCE(SUM(bt.borrowed_qty - bt.returned_qty), 0)
  INTO v_borrowed_qty
  FROM public.borrow_transactions bt
  WHERE bt.asset_id = OLD.id AND bt.status != 'Returned';

  IF v_borrowed_qty > 0 THEN
    RAISE EXCEPTION 'Cannot delete this asset because there are still borrowed items (%). Please return all borrowed items before deleting.', v_borrowed_qty;
  END IF;

  RETURN OLD;
END;
$function$;

-- Create receiver_evidence table (separate from preparing/tracking evidence)
CREATE TABLE public.receiver_evidence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_tracking_assignment_id UUID NOT NULL REFERENCES public.order_tracking_assignments(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  remarks TEXT
);

ALTER TABLE public.receiver_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view receiver evidence for accessible orders"
ON public.receiver_evidence
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM order_tracking_assignments ota
  JOIN orders o ON o.id = ota.order_id
  WHERE ota.id = receiver_evidence.order_tracking_assignment_id
  AND has_project_access(auth.uid(), o.project_id)
));

CREATE POLICY "Authorized users can manage receiver evidence"
ON public.receiver_evidence
FOR ALL
USING (
  (EXISTS (
    SELECT 1 FROM order_tracking_assignments ota
    JOIN orders o ON o.id = ota.order_id
    WHERE ota.id = receiver_evidence.order_tracking_assignment_id
    AND has_project_access(auth.uid(), o.project_id)
  ))
  AND (is_admin(auth.uid()) OR can_process_logistics(auth.uid()) OR can_receive_orders(auth.uid()))
);

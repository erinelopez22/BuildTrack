
-- A) Create order_evidence table for multi-photo evidence uploads
CREATE TABLE public.order_evidence (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  status_context text NOT NULL DEFAULT 'preparing',
  file_url text NOT NULL,
  file_path text,
  file_name text NOT NULL,
  uploaded_by uuid NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  original_size_bytes integer,
  compressed_size_bytes integer,
  width integer,
  height integer
);

ALTER TABLE public.order_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view evidence for accessible orders"
ON public.order_evidence FOR SELECT
USING (has_project_access(auth.uid(), project_id));

CREATE POLICY "Authorized users can manage evidence"
ON public.order_evidence FOR ALL
USING (
  has_project_access(auth.uid(), project_id) AND
  (is_admin(auth.uid()) OR can_process_logistics(auth.uid()) OR can_receive_orders(auth.uid()))
);

CREATE INDEX idx_order_evidence_order_id ON public.order_evidence(order_id);
CREATE INDEX idx_order_evidence_status_context ON public.order_evidence(status_context);

-- B) Add tracking_remarks fields to order_tracking_assignments
ALTER TABLE public.order_tracking_assignments
  ADD COLUMN IF NOT EXISTS tracking_remarks text,
  ADD COLUMN IF NOT EXISTS remarks_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS remarks_updated_by uuid;

-- B) Add milestone timestamps to orders table (order-level, not per-driver)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS on_transit_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
-- Note: arrived_at is already per-driver in order_tracking_assignments

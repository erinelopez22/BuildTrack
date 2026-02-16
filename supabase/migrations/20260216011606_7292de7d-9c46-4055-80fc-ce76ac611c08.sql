
ALTER TABLE public.order_tracking_assignments
  ADD COLUMN resumed_at timestamptz,
  ADD COLUMN resume_remarks text;

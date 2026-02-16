
-- Add per-driver tracking status columns
ALTER TABLE public.order_tracking_assignments
  ADD COLUMN tracking_status text NOT NULL DEFAULT 'on_transit',
  ADD COLUMN arrived_at timestamptz,
  ADD COLUMN hold_remarks text,
  ADD COLUMN held_at timestamptz;

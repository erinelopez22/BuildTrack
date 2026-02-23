
ALTER TABLE public.borrow_transactions
  ADD COLUMN IF NOT EXISTS borrow_requested_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS borrow_requested_by uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS borrow_approved_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS borrow_approved_by uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS return_requested_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS return_requested_by uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS return_approved_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS return_approved_by uuid DEFAULT NULL;


-- 1) Quotation Change Requests table
CREATE TABLE public.quotation_change_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  quotation_id UUID REFERENCES public.project_quotations(id) ON DELETE SET NULL,
  change_type TEXT NOT NULL CHECK (change_type IN ('create', 'update', 'delete')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_by UUID NOT NULL,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  review_remarks TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.quotation_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view change requests for accessible projects"
  ON public.quotation_change_requests FOR SELECT
  USING (has_project_access(auth.uid(), project_id));

CREATE POLICY "Authenticated users can create change requests"
  ON public.quotation_change_requests FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND has_project_access(auth.uid(), project_id));

CREATE POLICY "Admins can update change requests"
  ON public.quotation_change_requests FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete change requests"
  ON public.quotation_change_requests FOR DELETE
  USING (is_admin(auth.uid()));

-- 2) Add category to project_quotations
ALTER TABLE public.project_quotations
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'initial'
  CHECK (category IN ('initial', 'additional'));

-- Drop existing unique constraint on project_id (one-to-one) to allow multiple quotations per project
ALTER TABLE public.project_quotations DROP CONSTRAINT IF EXISTS project_quotations_project_id_fkey;
ALTER TABLE public.project_quotations
  ADD CONSTRAINT project_quotations_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

-- 3) Add delivery_remarks to order_tracking_assignments
ALTER TABLE public.order_tracking_assignments
  ADD COLUMN IF NOT EXISTS delivery_remarks TEXT,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- 4) Company Assets table
CREATE TABLE public.company_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_name TEXT NOT NULL,
  asset_type TEXT NOT NULL DEFAULT 'Material' CHECK (asset_type IN ('Material', 'Tool', 'Equipment')),
  asset_code TEXT,
  unit TEXT,
  total_quantity INTEGER NOT NULL DEFAULT 0,
  condition TEXT DEFAULT 'Available' CHECK (condition IN ('Available', 'Maintenance', 'Retired')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

ALTER TABLE public.company_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view company assets"
  ON public.company_assets FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage company assets"
  ON public.company_assets FOR ALL
  USING (is_admin(auth.uid()));

-- 5) Borrow Transactions table
CREATE TABLE public.borrow_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES public.company_assets(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  borrowed_qty INTEGER NOT NULL CHECK (borrowed_qty > 0),
  borrowed_by UUID NOT NULL,
  borrowed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expected_return_date DATE,
  returned_qty INTEGER NOT NULL DEFAULT 0,
  returned_at TIMESTAMPTZ,
  return_remarks TEXT,
  status TEXT NOT NULL DEFAULT 'Borrowed' CHECK (status IN ('Borrowed', 'Partially Returned', 'Returned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.borrow_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view borrow transactions"
  ON public.borrow_transactions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Project members can create borrow transactions"
  ON public.borrow_transactions FOR INSERT
  WITH CHECK (has_project_access(auth.uid(), project_id));

CREATE POLICY "Project members can update borrow transactions"
  ON public.borrow_transactions FOR UPDATE
  USING (has_project_access(auth.uid(), project_id));

CREATE POLICY "Admins can manage all borrow transactions"
  ON public.borrow_transactions FOR ALL
  USING (is_admin(auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_quotation_change_requests_updated_at
  BEFORE UPDATE ON public.quotation_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_company_assets_updated_at
  BEFORE UPDATE ON public.company_assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_borrow_transactions_updated_at
  BEFORE UPDATE ON public.borrow_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

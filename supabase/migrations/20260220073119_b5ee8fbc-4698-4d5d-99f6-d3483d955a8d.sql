
-- Create equipment_requests table for borrow/return approval workflow
CREATE TABLE public.equipment_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id),
  asset_id uuid NOT NULL REFERENCES public.company_assets(id),
  request_type text NOT NULL CHECK (request_type IN ('borrow', 'return')),
  requested_by uuid NOT NULL,
  requested_at timestamp with time zone NOT NULL DEFAULT now(),
  quantity integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'for_approval' CHECK (status IN ('for_approval', 'approved', 'rejected')),
  approved_by uuid,
  approved_at timestamp with time zone,
  rejected_by uuid,
  rejected_at timestamp with time zone,
  rejection_reason text,
  notes text,
  -- For return requests, link to the borrow transaction being returned
  borrow_transaction_id uuid REFERENCES public.borrow_transactions(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.equipment_requests ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can view equipment requests
CREATE POLICY "Authenticated users can view equipment requests"
  ON public.equipment_requests
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Authorized roles can create requests (super_admin, admin, office_admin, project_engineer)
CREATE POLICY "Authorized users can create equipment requests"
  ON public.equipment_requests
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND (
      is_admin(auth.uid()) OR
      is_office_admin(auth.uid()) OR
      has_role(auth.uid(), 'project_engineer'::app_role)
    )
  );

-- Only super_admin and admin can update (approve/reject)
CREATE POLICY "Admins can update equipment requests"
  ON public.equipment_requests
  FOR UPDATE
  USING (is_admin(auth.uid()));

-- Only super_admin and admin can delete
CREATE POLICY "Admins can delete equipment requests"
  ON public.equipment_requests
  FOR DELETE
  USING (is_admin(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER update_equipment_requests_updated_at
  BEFORE UPDATE ON public.equipment_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

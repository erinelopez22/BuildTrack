-- Create order_tracking_assignments table
CREATE TABLE public.order_tracking_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  driver_user_id UUID NOT NULL,
  plate_number TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create order_tracking_evidence table
CREATE TABLE public.order_tracking_evidence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_tracking_assignment_id UUID NOT NULL REFERENCES public.order_tracking_assignments(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.order_tracking_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_tracking_evidence ENABLE ROW LEVEL SECURITY;

-- RLS policies for order_tracking_assignments
CREATE POLICY "Users can view tracking assignments for accessible orders"
ON public.order_tracking_assignments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_tracking_assignments.order_id
    AND has_project_access(auth.uid(), o.project_id)
  )
);

CREATE POLICY "Authorized users can manage tracking assignments"
ON public.order_tracking_assignments
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_tracking_assignments.order_id
    AND has_project_access(auth.uid(), o.project_id)
  )
  AND (is_admin(auth.uid()) OR can_process_logistics(auth.uid()))
);

-- RLS policies for order_tracking_evidence
CREATE POLICY "Users can view tracking evidence for accessible orders"
ON public.order_tracking_evidence
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.order_tracking_assignments ota
    JOIN public.orders o ON o.id = ota.order_id
    WHERE ota.id = order_tracking_evidence.order_tracking_assignment_id
    AND has_project_access(auth.uid(), o.project_id)
  )
);

CREATE POLICY "Authorized users can manage tracking evidence"
ON public.order_tracking_evidence
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.order_tracking_assignments ota
    JOIN public.orders o ON o.id = ota.order_id
    WHERE ota.id = order_tracking_evidence.order_tracking_assignment_id
    AND has_project_access(auth.uid(), o.project_id)
  )
  AND (is_admin(auth.uid()) OR can_process_logistics(auth.uid()))
);

-- Create storage bucket for tracking evidence
INSERT INTO storage.buckets (id, name, public) 
VALUES ('tracking-evidence', 'tracking-evidence', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for tracking evidence
CREATE POLICY "Anyone can view tracking evidence files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'tracking-evidence');

CREATE POLICY "Authenticated users can upload tracking evidence"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'tracking-evidence' AND auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete tracking evidence"
ON storage.objects
FOR DELETE
USING (bucket_id = 'tracking-evidence' AND is_admin(auth.uid()));
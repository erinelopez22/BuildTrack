-- Create project quotations table
CREATE TABLE public.project_quotations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  UNIQUE(project_id) -- One quotation per project
);

-- Create quotation items table
CREATE TABLE public.quotation_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quotation_id UUID NOT NULL REFERENCES public.project_quotations(id) ON DELETE CASCADE,
  material_name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'pcs',
  quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.project_quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for project_quotations
-- Project members can view quotations
CREATE POLICY "Users can view project quotations"
  ON public.project_quotations
  FOR SELECT
  USING (has_project_access(auth.uid(), project_id));

-- Only admins and project engineers (project_manager role) can insert
CREATE POLICY "Admins and project managers can create quotations"
  ON public.project_quotations
  FOR INSERT
  WITH CHECK (
    is_admin(auth.uid()) 
    OR get_project_role(auth.uid(), project_id) = 'project_manager'
  );

-- Only admins and project engineers can update
CREATE POLICY "Admins and project managers can update quotations"
  ON public.project_quotations
  FOR UPDATE
  USING (
    is_admin(auth.uid()) 
    OR get_project_role(auth.uid(), project_id) = 'project_manager'
  );

-- Only admins can delete quotations
CREATE POLICY "Admins can delete quotations"
  ON public.project_quotations
  FOR DELETE
  USING (is_admin(auth.uid()));

-- RLS policies for quotation_items
-- Users can view items if they can view the parent quotation
CREATE POLICY "Users can view quotation items"
  ON public.quotation_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_quotations pq
      WHERE pq.id = quotation_items.quotation_id
      AND has_project_access(auth.uid(), pq.project_id)
    )
  );

-- Admins and project managers can insert items
CREATE POLICY "Admins and project managers can create quotation items"
  ON public.quotation_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.project_quotations pq
      WHERE pq.id = quotation_items.quotation_id
      AND (is_admin(auth.uid()) OR get_project_role(auth.uid(), pq.project_id) = 'project_manager')
    )
  );

-- Admins and project managers can update items
CREATE POLICY "Admins and project managers can update quotation items"
  ON public.quotation_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.project_quotations pq
      WHERE pq.id = quotation_items.quotation_id
      AND (is_admin(auth.uid()) OR get_project_role(auth.uid(), pq.project_id) = 'project_manager')
    )
  );

-- Admins and project managers can delete items
CREATE POLICY "Admins and project managers can delete quotation items"
  ON public.quotation_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.project_quotations pq
      WHERE pq.id = quotation_items.quotation_id
      AND (is_admin(auth.uid()) OR get_project_role(auth.uid(), pq.project_id) = 'project_manager')
    )
  );

-- Add update trigger for updated_at
CREATE TRIGGER update_project_quotations_updated_at
  BEFORE UPDATE ON public.project_quotations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_quotation_items_updated_at
  BEFORE UPDATE ON public.quotation_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
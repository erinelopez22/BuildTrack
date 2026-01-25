-- Fix function search path issues
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := 'PO-' || to_char(now(), 'YYYYMMDD') || '-' || 
      lpad((SELECT count(*) + 1 FROM public.orders WHERE created_at::date = now()::date)::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_sku_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.sku_code IS NULL OR NEW.sku_code = '' THEN
    NEW.sku_code := 'SKU-' || lpad((SELECT count(*) + 1 FROM public.skus)::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- Drop and recreate overly permissive policies with proper checks

-- Notifications insert: Only system/authenticated users can insert for themselves or admins can insert for others
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "Users can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- SMS logs insert: Only admins can insert
DROP POLICY IF EXISTS "System can insert sms logs" ON public.sms_logs;
CREATE POLICY "Admins can insert sms logs"
  ON public.sms_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

-- Audit logs insert: Only admins can insert
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
CREATE POLICY "Admins can insert audit logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));
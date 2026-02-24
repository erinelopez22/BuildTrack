
-- Allow service role / authenticated inserts into email_logs (edge function uses service role)
DROP POLICY IF EXISTS "Admins can insert email logs" ON public.email_logs;
CREATE POLICY "Service can insert email logs" ON public.email_logs
  FOR INSERT WITH CHECK (true);

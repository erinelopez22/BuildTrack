
-- Add email_opt_in fields to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS email_opt_in boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_pref_updated_at timestamp with time zone NULL,
  ADD COLUMN IF NOT EXISTS email_pref_updated_by uuid NULL;

-- Create notification_settings table
CREATE TABLE IF NOT EXISTS public.notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'resend',
  email_enabled boolean NOT NULL DEFAULT true,
  from_name text NULL,
  from_email text NULL,
  reply_to text NULL,
  api_key_set boolean NOT NULL DEFAULT false,
  api_key_updated_at timestamp with time zone NULL,
  api_key_updated_by uuid NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid NULL
);

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage notification settings" ON public.notification_settings
  FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "Admins can view notification settings" ON public.notification_settings
  FOR SELECT USING (is_admin(auth.uid()));

-- Create email_logs table
CREATE TABLE IF NOT EXISTS public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode text NOT NULL DEFAULT 'event',
  event_type text NULL,
  entity_type text NULL,
  entity_id text NULL,
  project_id uuid NULL,
  to_user_id uuid NULL,
  to_email text NOT NULL,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  provider text NOT NULL DEFAULT 'resend',
  provider_message_id text NULL,
  error text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view email logs" ON public.email_logs
  FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert email logs" ON public.email_logs
  FOR INSERT WITH CHECK (is_admin(auth.uid()));

-- Insert default notification settings row
INSERT INTO public.notification_settings (provider, email_enabled, from_name, from_email)
VALUES ('resend', true, 'BuildTrack', 'noreply@buildtrack.app')
ON CONFLICT DO NOTHING;

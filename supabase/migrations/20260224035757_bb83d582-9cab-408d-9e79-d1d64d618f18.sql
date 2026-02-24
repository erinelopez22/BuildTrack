
-- Add SMTP columns to notification_settings
ALTER TABLE public.notification_settings
  ADD COLUMN IF NOT EXISTS smtp_host text DEFAULT 'smtp.gmail.com',
  ADD COLUMN IF NOT EXISTS smtp_port integer DEFAULT 587,
  ADD COLUMN IF NOT EXISTS smtp_user text,
  ADD COLUMN IF NOT EXISTS smtp_pass text;

-- Update existing row to gmail_smtp provider
UPDATE public.notification_settings SET provider = 'gmail_smtp' WHERE provider = 'resend';

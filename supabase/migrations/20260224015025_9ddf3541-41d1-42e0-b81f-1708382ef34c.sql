
-- Add mobile_updated_at and mobile_updated_by to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mobile_updated_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS mobile_updated_by uuid NULL;

-- Allow admins to update any profile (for SMS management)
CREATE POLICY "Admins can update any profile"
  ON public.profiles
  FOR UPDATE
  USING (is_admin(auth.uid()));

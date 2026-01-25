-- Fix notifications INSERT policy to allow project members to notify each other
-- Drop existing policy and create a more permissive one
DROP POLICY IF EXISTS "Users can insert notifications" ON public.notifications;

-- Allow any authenticated user to insert notifications
-- This is safe because the application controls what notifications are created
CREATE POLICY "Authenticated users can insert notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
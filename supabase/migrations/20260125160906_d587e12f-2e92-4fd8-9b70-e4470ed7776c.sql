-- Add 'rejected' status to order_status enum
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'rejected';

-- Add rejection tracking columns to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS rejected_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
ADD COLUMN IF NOT EXISTS rejection_reason text;
-- Add previous_status column to orders for On-Hold resume functionality
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS previous_status text DEFAULT NULL;
-- Add new order statuses to the order_status enum
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'submitted';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'preparing';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'on_hold';
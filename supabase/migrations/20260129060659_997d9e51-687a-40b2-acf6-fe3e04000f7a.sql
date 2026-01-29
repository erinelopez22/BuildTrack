-- Add quotation_item_id to order_items to reference the quotation item being ordered
ALTER TABLE public.order_items 
ADD COLUMN quotation_item_id uuid REFERENCES public.quotation_items(id);

-- Create index for performance
CREATE INDEX idx_order_items_quotation_item_id ON public.order_items(quotation_item_id);
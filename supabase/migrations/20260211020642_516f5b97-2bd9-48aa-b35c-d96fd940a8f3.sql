
-- Add composite unique constraint on normalized name + unit for SKUs
CREATE UNIQUE INDEX idx_skus_name_unit_unique 
ON public.skus (UPPER(TRIM(name)), UPPER(TRIM(unit_of_measure)));

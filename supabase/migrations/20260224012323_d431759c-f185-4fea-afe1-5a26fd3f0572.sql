
CREATE OR REPLACE FUNCTION public.generate_order_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  next_seq integer;
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    SELECT COALESCE(MAX(
      CASE 
        WHEN order_number ~ ('^PO-' || to_char(now(), 'YYYYMMDD') || '-[0-9]{4}$')
        THEN CAST(RIGHT(order_number, 4) AS integer)
        ELSE 0
      END
    ), 0) + 1
    INTO next_seq
    FROM public.orders
    WHERE order_number LIKE 'PO-' || to_char(now(), 'YYYYMMDD') || '-%';
    
    NEW.order_number := 'PO-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(next_seq::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$function$;

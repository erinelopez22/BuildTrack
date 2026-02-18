
-- Auto-generate asset_code via trigger
CREATE OR REPLACE FUNCTION public.generate_asset_code()
RETURNS TRIGGER AS $$
DECLARE
  prefix TEXT;
  next_seq INTEGER;
  date_part TEXT;
BEGIN
  IF NEW.asset_code IS NULL OR NEW.asset_code = '' THEN
    CASE NEW.asset_type
      WHEN 'Tool' THEN prefix := 'TOOL';
      WHEN 'Equipment' THEN prefix := 'EQP';
      ELSE prefix := 'MAT';
    END CASE;

    date_part := to_char(now(), 'YYYYMMDD');

    SELECT COALESCE(MAX(
      CASE 
        WHEN asset_code ~ ('^' || prefix || '-' || date_part || '-[0-9]{4}$')
        THEN CAST(RIGHT(asset_code, 4) AS integer)
        ELSE 0
      END
    ), 0) + 1
    INTO next_seq
    FROM public.company_assets
    WHERE asset_code LIKE prefix || '-' || date_part || '-%';

    NEW.asset_code := prefix || '-' || date_part || '-' || lpad(next_seq::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER generate_asset_code_trigger
BEFORE INSERT ON public.company_assets
FOR EACH ROW
EXECUTE FUNCTION public.generate_asset_code();

-- Add unique constraint on asset_code
CREATE UNIQUE INDEX IF NOT EXISTS idx_company_assets_asset_code_unique
ON public.company_assets (asset_code) WHERE asset_code IS NOT NULL;

-- Trigger to prevent updating total_quantity below borrowed quantity
CREATE OR REPLACE FUNCTION public.validate_asset_quantity_update()
RETURNS TRIGGER AS $$
DECLARE
  borrowed_qty INTEGER;
BEGIN
  SELECT COALESCE(SUM(borrowed_qty - returned_qty), 0)
  INTO borrowed_qty
  FROM public.borrow_transactions
  WHERE asset_id = NEW.id AND status != 'Returned';

  IF NEW.total_quantity < borrowed_qty THEN
    RAISE EXCEPTION 'Not allowed: Total quantity cannot be lower than currently borrowed quantity (%). Return borrowed items first or set the quantity to at least %.', borrowed_qty, borrowed_qty;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER validate_asset_quantity_update_trigger
BEFORE UPDATE ON public.company_assets
FOR EACH ROW
WHEN (OLD.total_quantity IS DISTINCT FROM NEW.total_quantity)
EXECUTE FUNCTION public.validate_asset_quantity_update();

-- Trigger to prevent deleting asset if there are borrowed items
CREATE OR REPLACE FUNCTION public.validate_asset_delete()
RETURNS TRIGGER AS $$
DECLARE
  borrowed_qty INTEGER;
BEGIN
  SELECT COALESCE(SUM(borrowed_qty - returned_qty), 0)
  INTO borrowed_qty
  FROM public.borrow_transactions
  WHERE asset_id = OLD.id AND status != 'Returned';

  IF borrowed_qty > 0 THEN
    RAISE EXCEPTION 'Cannot delete this asset because there are still borrowed items (%). Please return all borrowed items before deleting.', borrowed_qty;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER validate_asset_delete_trigger
BEFORE DELETE ON public.company_assets
FOR EACH ROW
EXECUTE FUNCTION public.validate_asset_delete();

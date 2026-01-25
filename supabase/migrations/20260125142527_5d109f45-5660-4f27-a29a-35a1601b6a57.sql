-- Add estimated_cost column to projects table
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS estimated_cost numeric DEFAULT 0;

-- Seed sample projects for demonstration
INSERT INTO public.projects (name, description, estimated_cost, start_date, end_date, status, location, code) VALUES
  ('Downtown Office Tower', 'A 25-story commercial office building in the downtown business district with modern amenities and LEED certification.', 12500000, '2025-01-15', '2026-06-30', 'active', '123 Main Street, Downtown', 'PRJ-001'),
  ('Riverside Residential Complex', 'Luxury residential complex with 120 units, underground parking, and waterfront access.', 8750000, '2025-03-01', '2025-12-15', 'active', '456 River Road, Westside', 'PRJ-002'),
  ('Highway Bridge Renovation', 'Complete structural renovation of the aging highway bridge including seismic retrofitting.', 4200000, '2025-02-01', '2025-08-31', 'on_hold', 'Highway 101 Crossing', 'PRJ-003'),
  ('Community Recreation Center', 'New community recreation center with gymnasium, swimming pool, and multi-purpose rooms.', 6300000, '2024-09-01', '2025-04-30', 'completed', '789 Park Avenue, Eastside', 'PRJ-004'),
  ('Industrial Warehouse Expansion', 'Expansion of existing warehouse facility with additional 50,000 sq ft of storage space.', 3100000, NULL, NULL, 'active', '321 Industrial Blvd', 'PRJ-005')
ON CONFLICT DO NOTHING;
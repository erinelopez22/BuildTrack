-- Remove all sample/demo projects
DELETE FROM public.projects WHERE name IN (
  'Downtown Office Tower',
  'Riverside Condominiums',
  'Industrial Warehouse Complex',
  'Highway Bridge Expansion',
  'Community Center Renovation'
);
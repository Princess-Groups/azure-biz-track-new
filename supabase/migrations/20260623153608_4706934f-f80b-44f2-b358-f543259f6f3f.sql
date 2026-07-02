
INSERT INTO public.expense_categories (name, icon, color) VALUES
  ('Books', 'book', '#10B981'),
  ('Stationery', 'pencil-ruler', '#14B8A6'),
  ('Coffee', 'coffee', '#92400E'),
  ('Snacks', 'cookie', '#EAB308'),
  ('Food', 'utensils', '#EF4444')
ON CONFLICT (name) DO UPDATE SET icon = EXCLUDED.icon, color = EXCLUDED.color;

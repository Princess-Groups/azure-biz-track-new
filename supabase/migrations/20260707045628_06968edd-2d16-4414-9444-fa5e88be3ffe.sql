
CREATE TABLE public.collection_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.collection_accounts TO authenticated;
GRANT ALL ON public.collection_accounts TO service_role;

ALTER TABLE public.collection_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view collections"
  ON public.collection_accounts FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can insert collections"
  ON public.collection_accounts FOR INSERT
  TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','accountant']::app_role[]));

CREATE POLICY "Admins can update collections"
  ON public.collection_accounts FOR UPDATE
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','accountant']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','accountant']::app_role[]));

CREATE POLICY "Admins can delete collections"
  ON public.collection_accounts FOR DELETE
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','accountant']::app_role[]));

CREATE TRIGGER trg_collection_accounts_updated_at
  BEFORE UPDATE ON public.collection_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.collection_accounts (name) VALUES
  ('Nagercoil Collection'),
  ('Colachel Collection'),
  ('Vadasery Collection')
ON CONFLICT (name) DO NOTHING;

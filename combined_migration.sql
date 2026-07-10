
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('super_admin', 'accountant', 'branch_manager', 'viewer');
CREATE TYPE public.payment_mode AS ENUM ('cash', 'gpay', 'bank_transfer');
CREATE TYPE public.bank_type AS ENUM ('hdfc', 'kvb', 'canara', 'sbi', 'icici', 'axis', 'other', 'cash');
CREATE TYPE public.receivable_type AS ENUM ('cash_received', 'cash_returned', 'gpay_received', 'gpay_returned', 'transfer_received', 'transfer_returned');
CREATE TYPE public.receivable_status AS ENUM ('pending', 'settled', 'partial');

-- ============ UTILITY: updated_at ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  branch_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles app_role[])
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles))
$$;

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Super admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- ============ SIGNUP TRIGGER: profile + first user = super_admin ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE user_count INT;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);

  SELECT count(*) INTO user_count FROM auth.users;
  IF user_count <= 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ BRANCHES ============
CREATE TABLE public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All view branches" ON public.branches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage branches" ON public.branches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

INSERT INTO public.branches (name, code) VALUES
  ('Nagercoil Branch','NGC'),
  ('Vadasery Branch','VDS'),
  ('Colachel Branch','CLC'),
  ('School','SCH'),
  ('Other Revenue','OTH');

-- ============ ACCOUNTS ============
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  bank bank_type NOT NULL DEFAULT 'other',
  account_number TEXT,
  color TEXT NOT NULL DEFAULT '#00CFFF',
  is_active BOOLEAN NOT NULL DEFAULT true,
  current_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All view accounts" ON public.accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage accounts" ON public.accounts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE TRIGGER trg_accounts_updated BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.accounts (name, bank, color) VALUES
  ('HDFC Bank','hdfc','#004C8F'),
  ('KVB Current Account','kvb','#E30613'),
  ('KVB Savings Account 1','kvb','#F4A300'),
  ('KVB Savings Account 2','kvb','#9C27B0'),
  ('Canara Bank','canara','#F7B500'),
  ('Cash on Hand','cash','#00D4C4');

-- ============ MONTHLY OPENING BALANCES ============
CREATE TABLE public.monthly_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  year INT NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  closing_balance NUMERIC(14,2),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, year, month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_balances TO authenticated;
GRANT ALL ON public.monthly_balances TO service_role;
ALTER TABLE public.monthly_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All view balances" ON public.monthly_balances FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff manage balances" ON public.monthly_balances FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','accountant']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','accountant']::app_role[]));

-- ============ CATEGORIES ============
CREATE TABLE public.income_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  icon TEXT NOT NULL DEFAULT 'wallet',
  color TEXT NOT NULL DEFAULT '#00D4C4',
  is_active BOOLEAN NOT NULL DEFAULT true
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.income_categories TO authenticated;
GRANT ALL ON public.income_categories TO service_role;
ALTER TABLE public.income_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All view inc cats" ON public.income_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage inc cats" ON public.income_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

INSERT INTO public.income_categories (name, icon, color) VALUES
  ('Branch Sales','building-2','#00CFFF'),
  ('School Income','school','#00D4C4'),
  ('Book Sales','book-open','#3B82F6'),
  ('Promotion Revenue','megaphone','#F59E0B'),
  ('Other Revenue','sparkles','#8B5CF6');

CREATE TABLE public.expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  icon TEXT NOT NULL DEFAULT 'receipt',
  color TEXT NOT NULL DEFAULT '#EF4444',
  is_active BOOLEAN NOT NULL DEFAULT true
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_categories TO authenticated;
GRANT ALL ON public.expense_categories TO service_role;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All view exp cats" ON public.expense_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage exp cats" ON public.expense_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

INSERT INTO public.expense_categories (name, icon, color) VALUES
  ('Branch Expenses','building-2','#EF4444'),
  ('Personal Expenses','user','#F97316'),
  ('Head Office Royalty','crown','#A855F7'),
  ('Book Purchase Orders','package','#3B82F6'),
  ('Promotion Purchase Orders','megaphone','#F59E0B'),
  ('Petrol','bike','#10B981'),
  ('Other Expenses','more-horizontal','#6B7280');

-- ============ INCOME ============
CREATE TABLE public.income_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  txn_date DATE NOT NULL DEFAULT CURRENT_DATE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.income_categories(id) ON DELETE SET NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  payment_mode payment_mode NOT NULL DEFAULT 'cash',
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  notes TEXT,
  attachment_path TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.income_transactions TO authenticated;
GRANT ALL ON public.income_transactions TO service_role;
ALTER TABLE public.income_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All view income" ON public.income_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff insert income" ON public.income_transactions FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','accountant','branch_manager']::app_role[]));
CREATE POLICY "Staff update income" ON public.income_transactions FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','accountant']::app_role[]));
CREATE POLICY "Admin delete income" ON public.income_transactions FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','accountant']::app_role[]));
CREATE TRIGGER trg_income_updated BEFORE UPDATE ON public.income_transactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_income_date ON public.income_transactions(txn_date DESC);
CREATE INDEX idx_income_branch ON public.income_transactions(branch_id);
CREATE INDEX idx_income_account ON public.income_transactions(account_id);

-- ============ EXPENSE ============
CREATE TABLE public.expense_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  txn_date DATE NOT NULL DEFAULT CURRENT_DATE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  payment_mode payment_mode NOT NULL DEFAULT 'cash',
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  description TEXT,
  attachment_path TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_transactions TO authenticated;
GRANT ALL ON public.expense_transactions TO service_role;
ALTER TABLE public.expense_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All view expense" ON public.expense_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff insert expense" ON public.expense_transactions FOR INSERT TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','accountant','branch_manager']::app_role[]));
CREATE POLICY "Staff update expense" ON public.expense_transactions FOR UPDATE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','accountant']::app_role[]));
CREATE POLICY "Admin delete expense" ON public.expense_transactions FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','accountant']::app_role[]));
CREATE TRIGGER trg_expense_updated BEFORE UPDATE ON public.expense_transactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_expense_date ON public.expense_transactions(txn_date DESC);
CREATE INDEX idx_expense_branch ON public.expense_transactions(branch_id);
CREATE INDEX idx_expense_account ON public.expense_transactions(account_id);

-- ============ ACCOUNT TRANSFERS ============
CREATE TABLE public.account_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  txn_date DATE NOT NULL DEFAULT CURRENT_DATE,
  from_account_id UUID NOT NULL REFERENCES public.accounts(id),
  to_account_id UUID NOT NULL REFERENCES public.accounts(id),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (from_account_id <> to_account_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_transfers TO authenticated;
GRANT ALL ON public.account_transfers TO service_role;
ALTER TABLE public.account_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All view transfers" ON public.account_transfers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff manage transfers" ON public.account_transfers FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','accountant']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','accountant']::app_role[]));

-- ============ CASH RECEIVABLES (received/return tracking) ============
CREATE TABLE public.cash_receivables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  txn_date DATE NOT NULL DEFAULT CURRENT_DATE,
  type receivable_type NOT NULL,
  party_name TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  settled_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  status receivable_status NOT NULL DEFAULT 'pending',
  account_id UUID REFERENCES public.accounts(id),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_receivables TO authenticated;
GRANT ALL ON public.cash_receivables TO service_role;
ALTER TABLE public.cash_receivables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "All view receivables" ON public.cash_receivables FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff manage receivables" ON public.cash_receivables FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','accountant','branch_manager']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','accountant','branch_manager']::app_role[]));
CREATE TRIGGER trg_recv_updated BEFORE UPDATE ON public.cash_receivables FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ ACTIVITY LOGS ============
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin view logs" ON public.activity_logs FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','accountant']::app_role[]));
CREATE POLICY "Authenticated insert logs" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============ ACCOUNT BALANCE AUTO-UPDATE ============
-- Recompute current_balance = sum(income) - sum(expense) + sum(transfers_in) - sum(transfers_out)
CREATE OR REPLACE FUNCTION public.recompute_account_balance(_account_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inc NUMERIC; exp NUMERIC; t_in NUMERIC; t_out NUMERIC;
BEGIN
  SELECT COALESCE(SUM(amount),0) INTO inc FROM income_transactions WHERE account_id = _account_id;
  SELECT COALESCE(SUM(amount),0) INTO exp FROM expense_transactions WHERE account_id = _account_id;
  SELECT COALESCE(SUM(amount),0) INTO t_in FROM account_transfers WHERE to_account_id = _account_id;
  SELECT COALESCE(SUM(amount),0) INTO t_out FROM account_transfers WHERE from_account_id = _account_id;
  UPDATE accounts SET current_balance = inc - exp + t_in - t_out, updated_at = now() WHERE id = _account_id;
END; $$;

CREATE OR REPLACE FUNCTION public.trg_recompute_income()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN PERFORM recompute_account_balance(OLD.account_id); RETURN OLD;
  ELSE
    IF OLD.account_id IS DISTINCT FROM NEW.account_id AND OLD.account_id IS NOT NULL THEN PERFORM recompute_account_balance(OLD.account_id); END IF;
    PERFORM recompute_account_balance(NEW.account_id); RETURN NEW;
  END IF;
END; $$;
CREATE TRIGGER trg_income_balance AFTER INSERT OR UPDATE OR DELETE ON public.income_transactions FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_income();

CREATE OR REPLACE FUNCTION public.trg_recompute_expense()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN PERFORM recompute_account_balance(OLD.account_id); RETURN OLD;
  ELSE
    IF OLD.account_id IS DISTINCT FROM NEW.account_id AND OLD.account_id IS NOT NULL THEN PERFORM recompute_account_balance(OLD.account_id); END IF;
    PERFORM recompute_account_balance(NEW.account_id); RETURN NEW;
  END IF;
END; $$;
CREATE TRIGGER trg_expense_balance AFTER INSERT OR UPDATE OR DELETE ON public.expense_transactions FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_expense();

CREATE OR REPLACE FUNCTION public.trg_recompute_transfer()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    PERFORM recompute_account_balance(OLD.from_account_id);
    PERFORM recompute_account_balance(OLD.to_account_id);
    RETURN OLD;
  ELSE
    PERFORM recompute_account_balance(NEW.from_account_id);
    PERFORM recompute_account_balance(NEW.to_account_id);
    IF TG_OP = 'UPDATE' THEN
      IF OLD.from_account_id <> NEW.from_account_id THEN PERFORM recompute_account_balance(OLD.from_account_id); END IF;
      IF OLD.to_account_id <> NEW.to_account_id THEN PERFORM recompute_account_balance(OLD.to_account_id); END IF;
    END IF;
    RETURN NEW;
  END IF;
END; $$;
CREATE TRIGGER trg_transfer_balance AFTER INSERT OR UPDATE OR DELETE ON public.account_transfers FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_transfer();

-- ============ STORAGE policies for 'attachments' bucket ============
CREATE POLICY "Authenticated read attachments" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'attachments');
CREATE POLICY "Authenticated upload attachments" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own attachments" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============ FUTURE-READY STUB TABLES (locked down) ============
CREATE TABLE public.gst_records (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE public.employees    (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE public.salaries     (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE public.inventory_items (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE public.purchase_orders (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE public.loans        (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gst_records, public.employees, public.salaries, public.inventory_items, public.purchase_orders, public.loans TO authenticated;
GRANT ALL ON public.gst_records, public.employees, public.salaries, public.inventory_items, public.purchase_orders, public.loans TO service_role;
ALTER TABLE public.gst_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin only gst" ON public.gst_records FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "admin only emp" ON public.employees FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "admin only sal" ON public.salaries FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "admin only inv" ON public.inventory_items FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "admin only po"  ON public.purchase_orders FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "admin only ln"  ON public.loans FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

INSERT INTO public.expense_categories (name, icon, color) VALUES
  ('Books', 'book', '#10B981'),
  ('Stationery', 'pencil-ruler', '#14B8A6'),
  ('Coffee', 'coffee', '#92400E'),
  ('Snacks', 'cookie', '#EAB308'),
  ('Food', 'utensils', '#EF4444')
ON CONFLICT (name) DO UPDATE SET icon = EXCLUDED.icon, color = EXCLUDED.color;

-- 1. Profiles: restrict SELECT to self (and super admins)
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;
CREATE POLICY "Users view own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'super_admin'));

-- 2. user_roles: split ALL into explicit per-action policies (super_admin only)
DROP POLICY IF EXISTS "Super admins manage roles" ON public.user_roles;

CREATE POLICY "Super admins insert roles"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins update roles"
  ON public.user_roles
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins delete roles"
  ON public.user_roles
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

-- 3. Attachments bucket: add UPDATE policy with ownership check
CREATE POLICY "Users update own attachments"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'attachments'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'attachments'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

-- 4. Revoke public EXECUTE on SECURITY DEFINER functions that should not be
--    callable directly via the Data API. Trigger functions are only invoked
--    by the database itself; helper role-check functions only need to be
--    callable by 'authenticated' so RLS policies can evaluate them.

-- Trigger-only functions: revoke from everyone (triggers run as owner)
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_recompute_income() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_recompute_expense() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_recompute_transfer() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_account_balance(uuid) FROM PUBLIC, anon, authenticated;

-- Role-check helpers: revoke from PUBLIC and anon; keep authenticated for RLS
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid, public.app_role[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, public.app_role[]) TO authenticated;

-- 1) Tighten attachments bucket SELECT policy to owner folder only
DROP POLICY IF EXISTS "Authenticated users can read attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can read attachments" ON storage.objects;
DROP POLICY IF EXISTS "attachments_select" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated read attachments" ON storage.objects;

-- Remove any existing permissive SELECT policies on attachments to avoid duplicates
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND cmd = 'SELECT'
      AND qual LIKE '%attachments%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Users read own attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'attachments'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- 2) Harden has_role / has_any_role to always use auth.uid()
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles app_role[])
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = ANY(_roles)
  )
$$;

-- 3) Revoke EXECUTE from authenticated on all SECURITY DEFINER functions in public.
-- Keep has_role / has_any_role executable by authenticated (required by RLS policies).
DO $$
DECLARE fn record;
BEGIN
  FOR fn IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proname NOT IN ('has_role', 'has_any_role')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated',
                   fn.nspname, fn.proname, fn.args);
  END LOOP;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'staff' AND enumtypid = 'public.app_role'::regtype) THEN
    ALTER TYPE public.app_role ADD VALUE 'staff';
  END IF;
END $$;

ALTER TABLE public.expense_categories ADD COLUMN IF NOT EXISTS is_personal BOOLEAN NOT NULL DEFAULT false;

INSERT INTO public.expense_categories (name, icon, color, is_personal)
SELECT 'Personal', 'wallet', '#8B5CF6', true
WHERE NOT EXISTS (SELECT 1 FROM public.expense_categories WHERE lower(name) = 'personal');

DROP POLICY IF EXISTS "All view expense" ON public.expense_transactions;
CREATE POLICY "View expense (hide personal from staff)"
  ON public.expense_transactions FOR SELECT
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR NOT EXISTS (
      SELECT 1 FROM public.expense_categories ec
      WHERE ec.id = expense_transactions.category_id AND ec.is_personal = true
    )
  );

DROP POLICY IF EXISTS "Staff insert expense" ON public.expense_transactions;
CREATE POLICY "Insert expense (personal admin only)"
  ON public.expense_transactions FOR INSERT
  WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['super_admin','accountant','branch_manager','staff']::app_role[])
    AND (
      public.has_role(auth.uid(), 'super_admin')
      OR NOT EXISTS (
        SELECT 1 FROM public.expense_categories ec
        WHERE ec.id = expense_transactions.category_id AND ec.is_personal = true
      )
    )
  );

DROP POLICY IF EXISTS "Staff update expense" ON public.expense_transactions;
CREATE POLICY "Update expense (personal admin only)"
  ON public.expense_transactions FOR UPDATE
  USING (
    public.has_any_role(auth.uid(), ARRAY['super_admin','accountant']::app_role[])
    AND (
      public.has_role(auth.uid(), 'super_admin')
      OR NOT EXISTS (
        SELECT 1 FROM public.expense_categories ec
        WHERE ec.id = expense_transactions.category_id AND ec.is_personal = true
      )
    )
  );

DROP POLICY IF EXISTS "Admin delete expense" ON public.expense_transactions;
CREATE POLICY "Delete expense (personal admin only)"
  ON public.expense_transactions FOR DELETE
  USING (
    public.has_any_role(auth.uid(), ARRAY['super_admin','accountant']::app_role[])
    AND (
      public.has_role(auth.uid(), 'super_admin')
      OR NOT EXISTS (
        SELECT 1 FROM public.expense_categories ec
        WHERE ec.id = expense_transactions.category_id AND ec.is_personal = true
      )
    )
  );

DROP POLICY IF EXISTS "Staff insert income" ON public.income_transactions;
CREATE POLICY "Staff insert income"
  ON public.income_transactions FOR INSERT
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['super_admin','accountant','branch_manager','staff']::app_role[]));

DROP POLICY IF EXISTS "All view accounts" ON public.accounts;
CREATE POLICY "Privileged view accounts"
  ON public.accounts FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY['super_admin','accountant','branch_manager']::app_role[]));

ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS opening_balance NUMERIC NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.recompute_account_balance(_account_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE inc NUMERIC; exp NUMERIC; t_in NUMERIC; t_out NUMERIC; opening NUMERIC;
BEGIN
  SELECT COALESCE(opening_balance,0) INTO opening FROM accounts WHERE id = _account_id;
  SELECT COALESCE(SUM(amount),0) INTO inc FROM income_transactions WHERE account_id = _account_id;
  SELECT COALESCE(SUM(amount),0) INTO exp FROM expense_transactions WHERE account_id = _account_id;
  SELECT COALESCE(SUM(amount),0) INTO t_in FROM account_transfers WHERE to_account_id = _account_id;
  SELECT COALESCE(SUM(amount),0) INTO t_out FROM account_transfers WHERE from_account_id = _account_id;
  UPDATE accounts SET current_balance = opening + inc - exp + t_in - t_out, updated_at = now() WHERE id = _account_id;
END; $function$;

-- Trigger to recompute when opening_balance changes
CREATE OR REPLACE FUNCTION public.trg_recompute_account_opening()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.opening_balance IS DISTINCT FROM NEW.opening_balance THEN
    PERFORM recompute_account_balance(NEW.id);
  ELSIF TG_OP = 'INSERT' AND NEW.opening_balance <> 0 THEN
    PERFORM recompute_account_balance(NEW.id);
  END IF;
  RETURN NEW;
END; $function$;

DROP TRIGGER IF EXISTS accounts_recompute_on_opening ON public.accounts;
CREATE TRIGGER accounts_recompute_on_opening
AFTER INSERT OR UPDATE OF opening_balance ON public.accounts
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_account_opening();

-- Recompute all balances now
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.accounts LOOP
    PERFORM public.recompute_account_balance(r.id);
  END LOOP;
END $$;

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

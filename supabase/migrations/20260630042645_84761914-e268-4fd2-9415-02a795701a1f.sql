
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

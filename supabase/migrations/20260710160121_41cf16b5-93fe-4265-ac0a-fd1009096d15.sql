
-- Allow staff to edit and delete income entries
DROP POLICY IF EXISTS "Staff update income" ON public.income_transactions;
CREATE POLICY "Staff update income" ON public.income_transactions
  FOR UPDATE USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'accountant'::app_role,'branch_manager'::app_role,'staff'::app_role]));

DROP POLICY IF EXISTS "Admin delete income" ON public.income_transactions;
CREATE POLICY "Staff delete income" ON public.income_transactions
  FOR DELETE USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'accountant'::app_role,'branch_manager'::app_role,'staff'::app_role]));

-- Allow staff to edit and delete non-personal expense entries (personal remains super_admin only)
DROP POLICY IF EXISTS "Update expense (personal admin only)" ON public.expense_transactions;
CREATE POLICY "Update expense (personal admin only)" ON public.expense_transactions
  FOR UPDATE USING (
    has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'accountant'::app_role,'branch_manager'::app_role,'staff'::app_role])
    AND (
      has_role(auth.uid(), 'super_admin'::app_role)
      OR NOT EXISTS (SELECT 1 FROM expense_categories ec WHERE ec.id = expense_transactions.category_id AND ec.is_personal = true)
    )
  );

DROP POLICY IF EXISTS "Delete expense (personal admin only)" ON public.expense_transactions;
CREATE POLICY "Delete expense (personal admin only)" ON public.expense_transactions
  FOR DELETE USING (
    has_any_role(auth.uid(), ARRAY['super_admin'::app_role,'accountant'::app_role,'branch_manager'::app_role,'staff'::app_role])
    AND (
      has_role(auth.uid(), 'super_admin'::app_role)
      OR NOT EXISTS (SELECT 1 FROM expense_categories ec WHERE ec.id = expense_transactions.category_id AND ec.is_personal = true)
    )
  );

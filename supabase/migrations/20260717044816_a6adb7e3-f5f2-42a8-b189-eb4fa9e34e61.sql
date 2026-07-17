
-- Add cheque receivable types
ALTER TYPE public.receivable_type ADD VALUE IF NOT EXISTS 'cheque_received';
ALTER TYPE public.receivable_type ADD VALUE IF NOT EXISTS 'cheque_returned';

-- Add cheque fields to receivables
ALTER TABLE public.cash_receivables
  ADD COLUMN IF NOT EXISTS cheque_no TEXT,
  ADD COLUMN IF NOT EXISTS cheque_bank TEXT,
  ADD COLUMN IF NOT EXISTS cheque_date DATE;

-- Update recompute_account_balance to include settled receivables
CREATE OR REPLACE FUNCTION public.recompute_account_balance(_account_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE inc NUMERIC; exp NUMERIC; t_in NUMERIC; t_out NUMERIC; opening NUMERIC; r_in NUMERIC; r_out NUMERIC;
BEGIN
  SELECT COALESCE(opening_balance,0) INTO opening FROM accounts WHERE id = _account_id;
  SELECT COALESCE(SUM(amount),0) INTO inc FROM income_transactions WHERE account_id = _account_id;
  SELECT COALESCE(SUM(amount),0) INTO exp FROM expense_transactions WHERE account_id = _account_id;
  SELECT COALESCE(SUM(amount),0) INTO t_in FROM account_transfers WHERE to_account_id = _account_id;
  SELECT COALESCE(SUM(amount),0) INTO t_out FROM account_transfers WHERE from_account_id = _account_id;
  SELECT COALESCE(SUM(settled_amount),0) INTO r_in FROM cash_receivables
    WHERE account_id = _account_id
      AND type IN ('cash_received','gpay_received','transfer_received','cheque_received');
  SELECT COALESCE(SUM(settled_amount),0) INTO r_out FROM cash_receivables
    WHERE account_id = _account_id
      AND type IN ('cash_returned','gpay_returned','transfer_returned','cheque_returned');
  UPDATE accounts SET current_balance = opening + inc - exp + t_in - t_out + r_in - r_out, updated_at = now() WHERE id = _account_id;
END; $function$;

-- Trigger to recompute account when receivable changes
CREATE OR REPLACE FUNCTION public.trg_recompute_receivable()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    IF OLD.account_id IS NOT NULL THEN PERFORM recompute_account_balance(OLD.account_id); END IF;
    RETURN OLD;
  ELSE
    IF TG_OP = 'UPDATE' AND OLD.account_id IS DISTINCT FROM NEW.account_id AND OLD.account_id IS NOT NULL THEN
      PERFORM recompute_account_balance(OLD.account_id);
    END IF;
    IF NEW.account_id IS NOT NULL THEN PERFORM recompute_account_balance(NEW.account_id); END IF;
    RETURN NEW;
  END IF;
END; $function$;

DROP TRIGGER IF EXISTS trg_receivable_recompute ON public.cash_receivables;
CREATE TRIGGER trg_receivable_recompute
AFTER INSERT OR UPDATE OR DELETE ON public.cash_receivables
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_receivable();

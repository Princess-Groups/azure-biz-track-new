
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

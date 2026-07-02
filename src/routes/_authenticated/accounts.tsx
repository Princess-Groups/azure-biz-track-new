import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { BankBadge } from "@/components/BankBadge";
import { MonthlyBalanceDialog } from "@/components/MonthlyBalanceDialog";
import { OpeningBalanceDialog } from "@/components/OpeningBalanceDialog";
import { fetchAccounts, fetchIncome, fetchExpenses } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { inr } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Wallet, CalendarRange, TrendingUp, TrendingDown, PiggyBank, Pencil } from "lucide-react";

import { RequireRole } from "@/components/RequireRole";
import { ACCOUNTS_ROLES } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/accounts")({
  head: () => ({ meta: [{ title: "Accounts — CSC Computer Education" }] }),
  component: () => (
    <RequireRole roles={ACCOUNTS_ROLES}>
      <AccountsPage />
    </RequireRole>
  ),
});

const BANK_OPTIONS = ["hdfc","kvb","canara","sbi","icici","axis","other","cash"] as const;

function AccountsPage() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("super_admin");
  const qc = useQueryClient();
  const accounts = useQuery({ queryKey: ["accounts"], queryFn: fetchAccounts });
  const income = useQuery({ queryKey: ["income"], queryFn: () => fetchIncome(2000) });
  const expenses = useQuery({ queryKey: ["expenses"], queryFn: () => fetchExpenses(2000) });

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [bank, setBank] = useState<(typeof BANK_OPTIONS)[number]>("other");
  const [color, setColor] = useState("#00CFFF");
  const [acctNo, setAcctNo] = useState("");
  const [openingNew, setOpeningNew] = useState("0");
  const [mbAccount, setMbAccount] = useState<{ id: string; name: string } | null>(null);
  const [obAccount, setObAccount] = useState<{ id: string; name: string; opening: number } | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("accounts").insert({
        name,
        bank,
        color,
        account_number: acctNo || null,
        opening_balance: Number(openingNew || 0),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Account created");
      qc.invalidateQueries({ queryKey: ["accounts"] });
      setOpen(false);
      setName(""); setAcctNo(""); setOpeningNew("0");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const perAccount = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>();
    for (const a of accounts.data ?? []) map.set(a.id, { income: 0, expense: 0 });
    for (const r of income.data ?? []) {
      if (r.account_id && map.has(r.account_id)) map.get(r.account_id)!.income += Number(r.amount);
    }
    for (const r of expenses.data ?? []) {
      if (r.account_id && map.has(r.account_id)) map.get(r.account_id)!.expense += Number(r.amount);
    }
    return map;
  }, [accounts.data, income.data, expenses.data]);

  const totalBalance = (accounts.data ?? []).reduce((s, a) => s + Number(a.current_balance || 0), 0);
  const totalOpening = (accounts.data ?? []).reduce((s, a) => s + Number(a.opening_balance || 0), 0);
  const totalIncome = Array.from(perAccount.values()).reduce((s, v) => s + v.income, 0);
  const totalExpense = Array.from(perAccount.values()).reduce((s, v) => s + v.expense, 0);

  return (
    <AppShell
      title="Accounts"
      action={
        isAdmin && (
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl gradient-sky px-3 py-2 text-sm font-semibold text-white shadow-md"
          >
            <Plus className="h-4 w-4" /> New Account
          </button>
        )
      }
    >
      <div className="glass mb-5 rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl gradient-sky text-white shadow-md">
              <PiggyBank className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Total Balance Across All Accounts</p>
              <p className="text-2xl font-black text-gradient-sky">{inr(totalBalance)}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {accounts.data?.length ?? 0} account{(accounts.data?.length ?? 0) === 1 ? "" : "s"}
          </p>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-white/60 p-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Opening</p>
            <p className="text-sm font-bold">{inr(totalOpening)}</p>
          </div>
          <div className="rounded-xl bg-emerald-50/80 p-2">
            <p className="text-[10px] uppercase tracking-wider text-emerald-700">+ Income</p>
            <p className="text-sm font-bold">{inr(totalIncome)}</p>
          </div>
          <div className="rounded-xl bg-rose-50/80 p-2">
            <p className="text-[10px] uppercase tracking-wider text-rose-700">− Expense</p>
            <p className="text-sm font-bold">{inr(totalExpense)}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(accounts.data ?? []).map((a) => {
          const tot = perAccount.get(a.id) ?? { income: 0, expense: 0 };
          return (
            <div key={a.id} className="glass rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <BankBadge bank={a.bank as never} color={a.color} size={52} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{a.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.bank.toUpperCase()}{a.account_number ? ` · ${a.account_number}` : ""}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-xl gradient-sky p-3 text-white shadow-md">
                <p className="text-[10px] uppercase tracking-wider opacity-90">Current Balance</p>
                <p className="text-2xl font-black">{inr(a.current_balance)}</p>
                <p className="mt-0.5 text-[10px] opacity-80">Opening + Income − Expenses (live)</p>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-cyan-50/70 p-2">
                  <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-cyan-700">
                    <Wallet className="h-3 w-3" /> Opening
                  </div>
                  <p className="mt-0.5 truncate text-sm font-bold">{inr(a.opening_balance)}</p>
                </div>
                <div className="rounded-xl bg-emerald-50/70 p-2">
                  <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                    <TrendingUp className="h-3 w-3" /> Income
                  </div>
                  <p className="mt-0.5 truncate text-sm font-bold">{inr(tot.income)}</p>
                </div>
                <div className="rounded-xl bg-rose-50/70 p-2">
                  <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-rose-700">
                    <TrendingDown className="h-3 w-3" /> Expense
                  </div>
                  <p className="mt-0.5 truncate text-sm font-bold">{inr(tot.expense)}</p>
                </div>
              </div>

              {isAdmin && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setObAccount({ id: a.id, name: a.name, opening: Number(a.opening_balance) })}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border bg-white/70 px-3 py-2 text-xs font-semibold text-foreground hover:bg-white"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Opening Balance
                  </button>
                  <button
                    onClick={() => setMbAccount({ id: a.id, name: a.name })}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border bg-white/70 px-3 py-2 text-xs font-semibold text-foreground hover:bg-white"
                  >
                    <CalendarRange className="h-3.5 w-3.5" /> Monthly
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {!accounts.data?.length && (
          <div className="glass col-span-full rounded-2xl p-10 text-center">
            <Wallet className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">No accounts yet.</p>
          </div>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4 backdrop-blur-sm">
          <div className="glass w-full max-w-md rounded-2xl p-6">
            <h2 className="text-lg font-bold">New Account</h2>
            <div className="mt-4 space-y-3">
              <input className="w-full rounded-xl border bg-white/70 px-3 py-2 text-sm" placeholder="Account name" value={name} onChange={(e) => setName(e.target.value)} />
              <select className="w-full rounded-xl border bg-white/70 px-3 py-2 text-sm" value={bank} onChange={(e) => setBank(e.target.value as never)}>
                {BANK_OPTIONS.map((b) => <option key={b} value={b}>{b.toUpperCase()}</option>)}
              </select>
              <input className="w-full rounded-xl border bg-white/70 px-3 py-2 text-sm" placeholder="Account number (optional)" value={acctNo} onChange={(e) => setAcctNo(e.target.value)} />
              <label className="block text-xs font-semibold text-muted-foreground">
                Opening Balance (₹)
                <input type="number" step="0.01" className="mt-1 w-full rounded-xl border bg-white/70 px-3 py-2 text-sm font-normal text-foreground" value={openingNew} onChange={(e) => setOpeningNew(e.target.value)} />
              </label>
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">Color</label>
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-16 rounded" />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="rounded-xl border bg-white/70 px-4 py-2 text-sm font-semibold">Cancel</button>
              <button onClick={() => create.mutate()} disabled={!name || create.isPending} className="rounded-xl gradient-sky px-4 py-2 text-sm font-semibold text-white shadow-md disabled:opacity-50">
                {create.isPending ? "Saving…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {mbAccount && (
        <MonthlyBalanceDialog
          accountId={mbAccount.id}
          accountName={mbAccount.name}
          onClose={() => setMbAccount(null)}
        />
      )}
      {obAccount && (
        <OpeningBalanceDialog
          accountId={obAccount.id}
          accountName={obAccount.name}
          current={obAccount.opening}
          onClose={() => setObAccount(null)}
        />
      )}
    </AppShell>
  );
}

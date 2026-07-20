import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { CategoryIcon } from "@/components/CategoryIcon";
import { RequireRole } from "@/components/RequireRole";
import { PERSONAL_EXPENSE_ROLES } from "@/lib/permissions";
import { fetchAccounts, fetchBranches, fetchExpenses, fetchExpenseCategories } from "@/lib/db";
import { TxnForm } from "@/components/TxnForm";
import { inr, fmtDate } from "@/lib/format";
import { exportToCSV } from "@/lib/csv";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Download, Search, Trash2, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/personal-expenses")({
  head: () => ({ meta: [{ title: "Personal Expenses — CSC Computer Education" }] }),
  component: () => (
    <RequireRole roles={PERSONAL_EXPENSE_ROLES}>
      <PersonalExpensesPage />
    </RequireRole>
  ),
});

function PersonalExpensesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const accounts = useQuery({ queryKey: ["accounts"], queryFn: fetchAccounts });
  const branches = useQuery({ queryKey: ["branches"], queryFn: fetchBranches });
  const cats = useQuery({ queryKey: ["expCats"], queryFn: fetchExpenseCategories });
  const list = useQuery({ queryKey: ["expenses"], queryFn: () => fetchExpenses(1000) });

  const personalCats = useMemo(
    () => (cats.data ?? []).filter((c) => c.is_personal),
    [cats.data],
  );
  const personalCatIds = useMemo(() => new Set(personalCats.map((c) => c.id)), [personalCats]);
  const catMap = new Map((cats.data ?? []).map((c) => [c.id, c] as const));

  const personalRows = useMemo(
    () => (list.data ?? []).filter((r) => r.category_id && personalCatIds.has(r.category_id)),
    [list.data, personalCatIds],
  );

  const filtered = useMemo(() => {
    const rows = personalRows.filter((r) => {
      if (!q) return true;
      const text = `${catMap.get(r.category_id ?? "")?.name ?? ""} ${r.description ?? ""} ${r.amount}`.toLowerCase();
      return text.includes(q.toLowerCase());
    });
    return rows.sort((a, b) => {
      const an = (catMap.get(a.category_id ?? "")?.name ?? "").toLowerCase();
      const bn = (catMap.get(b.category_id ?? "")?.name ?? "").toLowerCase();
      if (an !== bn) return an.localeCompare(bn);
      return a.txn_date < b.txn_date ? 1 : -1;
    });
  }, [personalRows, q, catMap]);

  const total = personalRows.reduce((a, r) => a + Number(r.amount), 0);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expense_transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <AppShell
      title="Personal Expenses"
      action={
        <div className="flex gap-2">
          <button
            onClick={() =>
              exportToCSV(
                "personal-expenses.csv",
                filtered.map((r) => ({
                  Date: r.txn_date,
                  Category: catMap.get(r.category_id ?? "")?.name ?? "",
                  Mode: r.payment_mode,
                  Amount: r.amount,
                  Description: r.description ?? "",
                })),
              )
            }
            className="inline-flex items-center gap-1.5 rounded-xl border bg-white/70 px-3 py-2 text-sm font-semibold"
          >
            <Download className="h-4 w-4" /> Export
          </button>
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl gradient-sky px-3 py-2 text-sm font-semibold text-white shadow-md"
          >
            <Plus className="h-4 w-4" /> Add Personal Expense
          </button>
        </div>
      }
    >
      <div className="glass mb-4 flex items-center gap-3 rounded-2xl border border-violet-200/60 bg-violet-50/50 p-4">
        <ShieldAlert className="h-5 w-5 shrink-0 text-violet-600" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-violet-900">Admin-only · Hidden from staff</p>
          <p className="text-xs text-violet-700">
            These records never appear in staff dashboards, reports, or the Business Expenses page.
          </p>
        </div>
        <div className="ml-auto shrink-0 rounded-xl bg-white/70 px-3 py-2 text-right">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total Personal</p>
          <p className="text-base font-bold text-violet-700">{inr(total)}</p>
        </div>
      </div>

      <div className="glass mb-4 flex items-center gap-3 rounded-2xl p-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search personal expenses..." className="w-full bg-transparent text-sm outline-none" />
        <span className="shrink-0 text-xs text-muted-foreground">{filtered.length} entries</span>
      </div>

      <div className="glass overflow-hidden rounded-2xl">
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-border/50 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          <span>Category (A–Z)</span>
          <span className="text-right">Amount</span>
          <span></span>
        </div>
        <div className="divide-y divide-border/50">
          {filtered.map((r) => {
            const c = catMap.get(r.category_id ?? "");
            return (
              <div key={r.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <CategoryIcon name={c?.icon} color={c?.color ?? "#8B5CF6"} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{c?.name ?? "Personal"}</p>
                    <p className="truncate text-xs text-muted-foreground">{fmtDate(r.txn_date)} · {r.description ?? "—"}</p>
                  </div>
                </div>
                <span className="text-right text-sm font-bold text-violet-700">−{inr(r.amount)}</span>
                <button onClick={() => confirm("Delete this entry?") && del.mutate(r.id)} className="grid h-8 w-8 place-items-center rounded-lg text-rose-500 hover:bg-rose-50">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
          {!filtered.length && (
            <p className="py-12 text-center text-sm text-muted-foreground">No personal expenses yet.</p>
          )}
        </div>
      </div>

      {open && (
        <TxnForm
          mode="expense"
          accounts={accounts.data ?? []}
          branches={branches.data ?? []}
          categories={personalCats}
          onClose={() => setOpen(false)}
          hideBranch
          isPersonal
        />
      )}
    </AppShell>
  );
}

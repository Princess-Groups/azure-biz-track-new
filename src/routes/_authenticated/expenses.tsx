import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { CategoryIcon, BranchIcon } from "@/components/CategoryIcon";
import { CategoryTotals } from "@/components/CategoryTotals";
import { fetchAccounts, fetchBranches, fetchExpenses, fetchExpenseCategories } from "@/lib/db";
import { TxnForm } from "@/components/TxnForm";
import { inr, fmtDate } from "@/lib/format";
import { exportToCSV } from "@/lib/csv";
import { useState, useMemo } from "react";
import { Plus, Download, Search, Trash2, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import type { EditingTxn } from "@/components/TxnForm";

export const Route = createFileRoute("/_authenticated/expenses")({
  head: () => ({ meta: [{ title: "Business Expenses — CSC Computer Education" }] }),
  component: ExpensesPage,
});

function ExpensesPage() {
  const { hasAnyRole } = useAuth();
  const canEdit = hasAnyRole(["super_admin", "accountant", "branch_manager", "staff"]);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EditingTxn | null>(null);
  const [q, setQ] = useState("");

  const accounts = useQuery({ queryKey: ["accounts"], queryFn: fetchAccounts });
  const branches = useQuery({ queryKey: ["branches"], queryFn: fetchBranches });
  const cats = useQuery({ queryKey: ["expCats"], queryFn: fetchExpenseCategories });
  const list = useQuery({ queryKey: ["expenses"], queryFn: () => fetchExpenses(1000) });

  // Business categories only (exclude personal)
  const businessCats = useMemo(
    () => (cats.data ?? []).filter((c) => !c.is_personal),
    [cats.data],
  );
  const businessCatIds = useMemo(() => new Set(businessCats.map((c) => c.id)), [businessCats]);

  const catMap = new Map((cats.data ?? []).map((c) => [c.id, c] as const));
  const branchMap = new Map((branches.data ?? []).map((b) => [b.id, b] as const));
  const accountMap = new Map((accounts.data ?? []).map((a) => [a.id, a] as const));

  // Filter out personal rows (defense-in-depth — RLS already hides them).
  const businessRows = useMemo(
    () => (list.data ?? []).filter((r) => !r.category_id || businessCatIds.has(r.category_id)),
    [list.data, businessCatIds],
  );

  const filtered = useMemo(() => {
    const rows = businessRows.filter((r) => {
      if (!q) return true;
      const text = `${catMap.get(r.category_id ?? "")?.name ?? ""} ${branchMap.get(r.branch_id ?? "")?.name ?? ""} ${r.description ?? ""} ${r.amount}`.toLowerCase();
      return text.includes(q.toLowerCase());
    });
    // Alphabetical by category name, then most recent date.
    return rows.sort((a, b) => {
      const an = (catMap.get(a.category_id ?? "")?.name ?? "").toLowerCase();
      const bn = (catMap.get(b.category_id ?? "")?.name ?? "").toLowerCase();
      if (an !== bn) return an.localeCompare(bn);
      return a.txn_date < b.txn_date ? 1 : -1;
    });
  }, [businessRows, q, catMap, branchMap]);

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
      title="Business Expenses"
      action={
        <div className="flex gap-2">
          <button
            onClick={() =>
              exportToCSV(
                "business-expenses.csv",
                filtered.map((r) => ({
                  Date: r.txn_date,
                  Branch: branchMap.get(r.branch_id ?? "")?.name ?? "",
                  Category: catMap.get(r.category_id ?? "")?.name ?? "",
                  Account: accountMap.get(r.account_id ?? "")?.name ?? "",
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
          <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl gradient-sky px-3 py-2 text-sm font-semibold text-white shadow-md">
            <Plus className="h-4 w-4" /> Add Expense
          </button>
        </div>
      }
    >
      <CategoryTotals categories={businessCats} rows={businessRows} tone="expense" />

      <div className="glass mb-4 flex items-center gap-3 rounded-2xl p-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search business expenses..." className="w-full bg-transparent text-sm outline-none" />
        <span className="shrink-0 text-xs text-muted-foreground">{filtered.length} entries</span>
      </div>

      <div className="glass overflow-hidden rounded-2xl">
        <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-border/50 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground sm:grid-cols-[2fr_1fr_1fr_1fr_auto_auto]">
          <span>Category (A–Z)</span>
          <span className="hidden sm:block">Branch</span>
          <span className="hidden sm:block">Mode</span>
          <span className="text-right">Amount</span>
          <span></span>
          <span></span>
        </div>
        <div className="divide-y divide-border/50">
          {filtered.map((r) => {
            const c = catMap.get(r.category_id ?? "");
            return (
              <div key={r.id} className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto_auto]">
                <div className="flex min-w-0 items-center gap-3">
                  <CategoryIcon name={c?.icon} color={c?.color ?? "#F43F5E"} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{c?.name ?? "Expense"}</p>
                    <p className="truncate text-xs text-muted-foreground">{fmtDate(r.txn_date)} · {r.description ?? "—"}</p>
                  </div>
                </div>
                <span className="hidden min-w-0 items-center gap-2 truncate text-xs sm:flex">
                  <BranchIcon code={branchMap.get(r.branch_id ?? "")?.code ?? null} size={24} title={branchMap.get(r.branch_id ?? "")?.name} />
                  <span className="truncate">{branchMap.get(r.branch_id ?? "")?.name ?? "—"}</span>
                </span>
                <span className="hidden text-xs uppercase sm:block">{r.payment_mode.replace("_", " ")}</span>
                <span className="text-right text-sm font-bold text-rose-600">−{inr(r.amount)}</span>
                {canEdit ? (
                  <button
                    onClick={() => setEditing({
                      id: r.id, txn_date: r.txn_date, branch_id: r.branch_id, category_id: r.category_id,
                      account_id: r.account_id, payment_mode: r.payment_mode, amount: r.amount, note: r.description,
                    })}
                    className="grid h-8 w-8 place-items-center rounded-lg text-primary hover:bg-primary/10"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                ) : <span />}
                {canEdit ? (
                  <button onClick={() => confirm("Delete this entry? This cannot be undone.") && del.mutate(r.id)} className="grid h-8 w-8 place-items-center rounded-lg text-rose-500 hover:bg-rose-50" title="Delete">
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : <span />}
              </div>
            );
          })}
          {!filtered.length && <p className="py-12 text-center text-sm text-muted-foreground">No business expense entries.</p>}
        </div>
      </div>

      {(open || editing) && (
        <TxnForm
          mode="expense"
          accounts={accounts.data ?? []}
          branches={branches.data ?? []}
          categories={businessCats}
          editing={editing}
          onClose={() => { setOpen(false); setEditing(null); }}
        />
      )}
    </AppShell>
  );
}

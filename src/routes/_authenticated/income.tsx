import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { CategoryIcon, BranchIcon } from "@/components/CategoryIcon";
import { CategoryTotals } from "@/components/CategoryTotals";
import { fetchAccounts, fetchBranches, fetchIncome, fetchIncomeCategories } from "@/lib/db";
import { TxnForm } from "@/components/TxnForm";
import { inr, fmtDate } from "@/lib/format";
import { exportToCSV } from "@/lib/csv";
import { useState } from "react";
import { Plus, Download, Search, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/income")({
  head: () => ({ meta: [{ title: "Income — CSC Computer Education" }] }),
  component: IncomePage,
});

function IncomePage() {
  const { hasAnyRole } = useAuth();
  const canEdit = hasAnyRole(["super_admin", "accountant"]);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const accounts = useQuery({ queryKey: ["accounts"], queryFn: fetchAccounts });
  const branches = useQuery({ queryKey: ["branches"], queryFn: fetchBranches });
  const cats = useQuery({ queryKey: ["incCats"], queryFn: fetchIncomeCategories });
  const list = useQuery({ queryKey: ["income"], queryFn: () => fetchIncome(1000) });

  const catMap = new Map((cats.data ?? []).map((c) => [c.id, c] as const));
  const branchMap = new Map((branches.data ?? []).map((b) => [b.id, b] as const));
  const accountMap = new Map((accounts.data ?? []).map((a) => [a.id, a] as const));

  const filtered = ((list.data ?? []).filter((r) => {
    if (!q) return true;
    const text = `${catMap.get(r.category_id ?? "")?.name ?? ""} ${branchMap.get(r.branch_id ?? "")?.name ?? ""} ${r.notes ?? ""} ${r.amount}`.toLowerCase();
    return text.includes(q.toLowerCase());
  })).sort((a, b) => {
    const an = (catMap.get(a.category_id ?? "")?.name ?? "").toLowerCase();
    const bn = (catMap.get(b.category_id ?? "")?.name ?? "").toLowerCase();
    if (an !== bn) return an.localeCompare(bn);
    return a.txn_date < b.txn_date ? 1 : -1;
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("income_transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["income"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <AppShell
      title="Income"
      action={
        <div className="flex gap-2">
          <button
            onClick={() =>
              exportToCSV(
                "income.csv",
                filtered.map((r) => ({
                  Date: r.txn_date,
                  Branch: branchMap.get(r.branch_id ?? "")?.name ?? "",
                  Category: catMap.get(r.category_id ?? "")?.name ?? "",
                  Account: accountMap.get(r.account_id ?? "")?.name ?? "",
                  Mode: r.payment_mode,
                  Amount: r.amount,
                  Notes: r.notes ?? "",
                })),
              )
            }
            className="inline-flex items-center gap-1.5 rounded-xl border bg-white/70 px-3 py-2 text-sm font-semibold"
          >
            <Download className="h-4 w-4" /> Export
          </button>
          <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl gradient-sky px-3 py-2 text-sm font-semibold text-white shadow-md">
            <Plus className="h-4 w-4" /> Add Income
          </button>
        </div>
      }
    >
      <CategoryTotals categories={cats.data ?? []} rows={list.data ?? []} tone="income" />

      <div className="glass mb-4 flex items-center gap-3 rounded-2xl p-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search income..." className="w-full bg-transparent text-sm outline-none" />
        <span className="shrink-0 text-xs text-muted-foreground">{filtered.length} entries</span>
      </div>

      <div className="glass overflow-hidden rounded-2xl">
        <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-border/50 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
          <span>Description</span>
          <span className="hidden sm:block">Branch</span>
          <span className="hidden sm:block">Mode</span>
          <span className="text-right">Amount</span>
          <span></span>
        </div>
        <div className="divide-y divide-border/50">
          {filtered.map((r) => {
            const c = catMap.get(r.category_id ?? "");
            return (
              <div key={r.id} className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
                <div className="flex min-w-0 items-center gap-3">
                  <CategoryIcon name={c?.icon} color={c?.color ?? "#00CFFF"} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{c?.name ?? "Income"}</p>
                    <p className="truncate text-xs text-muted-foreground">{fmtDate(r.txn_date)} · {r.notes ?? "—"}</p>
                  </div>
                </div>
                <span className="hidden min-w-0 items-center gap-2 truncate text-xs sm:flex">
                  <BranchIcon code={branchMap.get(r.branch_id ?? "")?.code ?? null} size={24} title={branchMap.get(r.branch_id ?? "")?.name} />
                  <span className="truncate">{branchMap.get(r.branch_id ?? "")?.name ?? "—"}</span>
                </span>
                <span className="hidden text-xs uppercase sm:block">{r.payment_mode.replace("_", " ")}</span>
                <span className="text-right text-sm font-bold text-emerald-600">+{inr(r.amount)}</span>
                {canEdit && (
                  <button onClick={() => confirm("Delete this entry?") && del.mutate(r.id)} className="grid h-8 w-8 place-items-center rounded-lg text-rose-500 hover:bg-rose-50">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
          {!filtered.length && <p className="py-12 text-center text-sm text-muted-foreground">No income entries.</p>}
        </div>
      </div>

      {open && (
        <TxnForm
          mode="income"
          accounts={accounts.data ?? []}
          branches={branches.data ?? []}
          categories={cats.data ?? []}
          onClose={() => setOpen(false)}
        />
      )}
    </AppShell>
  );
}

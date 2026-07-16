import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { CategoryIcon } from "@/components/CategoryIcon";
import {
  fetchAccounts, fetchBranches, fetchExpenseCategories, fetchExpenses,
  fetchIncome, fetchIncomeCategories, fetchTransfers,
} from "@/lib/db";
import { inr, fmtDate } from "@/lib/format";
import { useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";

import { RequireRole } from "@/components/RequireRole";
import { ADMIN_ROLES } from "@/lib/permissions";
import { ExportFilterDialog } from "@/components/ExportFilterDialog";

export const Route = createFileRoute("/_authenticated/transactions")({
  head: () => ({ meta: [{ title: "All Transactions — CSC Computer Education" }] }),
  component: () => <RequireRole roles={ADMIN_ROLES}><TxnsPage /></RequireRole>,
});

function TxnsPage() {
  const inc = useQuery({ queryKey: ["income"], queryFn: () => fetchIncome(1000) });
  const exp = useQuery({ queryKey: ["expenses"], queryFn: () => fetchExpenses(1000) });
  const tr = useQuery({ queryKey: ["transfers"], queryFn: () => fetchTransfers(500) });
  const accounts = useQuery({ queryKey: ["accounts"], queryFn: fetchAccounts });
  const branches = useQuery({ queryKey: ["branches"], queryFn: fetchBranches });
  const incCats = useQuery({ queryKey: ["incCats"], queryFn: fetchIncomeCategories });
  const expCats = useQuery({ queryKey: ["expCats"], queryFn: fetchExpenseCategories });

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "income" | "expense" | "transfer">("all");
  const [exportOpen, setExportOpen] = useState(false);

  const accountMap = new Map((accounts.data ?? []).map((a) => [a.id, a] as const));
  const branchMap = new Map((branches.data ?? []).map((b) => [b.id, b] as const));
  const incCatMap = new Map((incCats.data ?? []).map((c) => [c.id, c] as const));
  const expCatMap = new Map((expCats.data ?? []).map((c) => [c.id, c] as const));

  const rows = useMemo(() => {
    type Row = { id: string; kind: "income" | "expense" | "transfer"; date: string; label: string; sub: string; amount: number; color: string; icon?: string };
    const list: Row[] = [];
    for (const r of inc.data ?? []) {
      const c = incCatMap.get(r.category_id ?? "");
      list.push({
        id: `i-${r.id}`, kind: "income", date: r.txn_date,
        label: c?.name ?? "Income",
        sub: `${branchMap.get(r.branch_id ?? "")?.name ?? "—"} · ${r.payment_mode}`,
        amount: Number(r.amount), color: c?.color ?? "#00CFFF", icon: c?.icon,
      });
    }
    for (const r of exp.data ?? []) {
      const c = expCatMap.get(r.category_id ?? "");
      list.push({
        id: `e-${r.id}`, kind: "expense", date: r.txn_date,
        label: c?.name ?? "Expense",
        sub: `${branchMap.get(r.branch_id ?? "")?.name ?? "—"} · ${r.payment_mode}`,
        amount: Number(r.amount), color: c?.color ?? "#F43F5E", icon: c?.icon,
      });
    }
    for (const r of tr.data ?? []) {
      list.push({
        id: `t-${r.id}`, kind: "transfer", date: r.txn_date,
        label: `Transfer`,
        sub: `${accountMap.get(r.from_account_id)?.name ?? "?"} → ${accountMap.get(r.to_account_id)?.name ?? "?"}`,
        amount: Number(r.amount), color: "#8B5CF6", icon: "transfer",
      });
    }
    return list.sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [inc.data, exp.data, tr.data, incCatMap, expCatMap, branchMap, accountMap]);

  const filtered = rows.filter((r) => (filter === "all" || r.kind === filter) && (!q || `${r.label} ${r.sub}`.toLowerCase().includes(q.toLowerCase())));

  return (
    <AppShell
      title="All Transactions"
      action={
        <button
          onClick={() => setExportOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl border bg-white/70 px-3 py-2 text-sm font-semibold"
        ><SlidersHorizontal className="h-4 w-4" /> Export…</button>
      }
    >
      <div className="glass mb-4 flex flex-wrap items-center gap-3 rounded-2xl p-3">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search all..." className="min-w-[180px] flex-1 bg-transparent text-sm outline-none" />
        <div className="flex gap-1 rounded-xl bg-white/50 p-1">
          {(["all","income","expense","transfer"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-lg px-3 py-1 text-xs font-semibold capitalize ${filter === f ? "gradient-sky text-white" : "text-muted-foreground"}`}>{f}</button>
          ))}
        </div>
      </div>

      <div className="glass overflow-hidden rounded-2xl">
        <div className="divide-y divide-border/50">
          {filtered.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3">
              <CategoryIcon name={r.icon} color={r.color} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{r.label}</p>
                <p className="truncate text-xs text-muted-foreground">{fmtDate(r.date)} · {r.sub}</p>
              </div>
              <p className={`shrink-0 text-sm font-bold ${r.kind === "income" ? "text-emerald-600" : r.kind === "expense" ? "text-rose-600" : "text-violet-600"}`}>
                {r.kind === "income" ? "+" : r.kind === "expense" ? "−" : ""} {inr(r.amount)}
              </p>
            </div>
          ))}
          {!filtered.length && <p className="py-12 text-center text-sm text-muted-foreground">No matching transactions.</p>}
        </div>
      </div>

      {exportOpen && (
        <ExportFilterDialog
          onClose={() => setExportOpen(false)}
          income={inc.data ?? []}
          expenses={exp.data ?? []}
          incomeCats={incCats.data ?? []}
          expenseCats={expCats.data ?? []}
          branches={branches.data ?? []}
          accounts={accounts.data ?? []}
        />
      )}
    </AppShell>
  );
}

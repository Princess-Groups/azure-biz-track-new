import { createFileRoute } from "@tanstack/react-router";
import { RequireRole } from "@/components/RequireRole";
import { ADMIN_ROLES } from "@/lib/permissions";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { KpiCard } from "@/components/KpiCard";
import { fetchAccounts, fetchBranches, fetchExpenses, fetchIncome } from "@/lib/db";
import { inr, fmtDate, todayISO } from "@/lib/format";
import { exportToExcel } from "@/lib/csv";
import { Download, TrendingUp, TrendingDown, Activity, Wallet } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_authenticated/reports/daily")({
  head: () => ({ meta: [{ title: "Daily Report — CSC Computer Education" }] }),
  component: function DailyReportGated() { return <RequireRole roles={ADMIN_ROLES}><DailyReport /></RequireRole>; },
});

function DailyReport() {
  const [day, setDay] = useState(todayISO());
  const accounts = useQuery({ queryKey: ["accounts"], queryFn: fetchAccounts });
  const branches = useQuery({ queryKey: ["branches"], queryFn: fetchBranches });
  const inc = useQuery({ queryKey: ["income"], queryFn: () => fetchIncome(1000) });
  const exp = useQuery({ queryKey: ["expenses"], queryFn: () => fetchExpenses(1000) });

  const dayInc = (inc.data ?? []).filter((r) => r.txn_date === day);
  const dayExp = (exp.data ?? []).filter((r) => r.txn_date === day);
  const totalInc = dayInc.reduce((a, r) => a + Number(r.amount), 0);
  const totalExp = dayExp.reduce((a, r) => a + Number(r.amount), 0);

  const branchMap = useMemo(() => new Map((branches.data ?? []).map((b) => [b.id, b.name] as const)), [branches.data]);

  const byBranch = useMemo(() => {
    const list = branches.data ?? [];
    return list.map((b) => ({
      name: b.name,
      income: dayInc.filter((r) => r.branch_id === b.id).reduce((a, r) => a + Number(r.amount), 0),
      expense: dayExp.filter((r) => r.branch_id === b.id).reduce((a, r) => a + Number(r.amount), 0),
    }));
  }, [branches.data, dayInc, dayExp]);

  const totalBalance = (accounts.data ?? []).reduce((a, r) => a + Number(r.current_balance), 0);

  return (
    <AppShell
      title="Daily Report"
      action={
        <button
          onClick={() => {
            const rows = [
              ...dayInc.map((r) => ({ Type: "Income", Date: r.txn_date, Branch: branchMap.get(r.branch_id ?? "") ?? "", Mode: r.payment_mode, Amount: r.amount, Notes: r.notes ?? "" })),
              ...dayExp.map((r) => ({ Type: "Expense", Date: r.txn_date, Branch: branchMap.get(r.branch_id ?? "") ?? "", Mode: r.payment_mode, Amount: r.amount, Notes: r.description ?? "" })),
            ];
            exportToExcel(`daily-${day}.xlsx`, rows);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl border bg-white/70 px-3 py-2 text-sm font-semibold"
        ><Download className="h-4 w-4" /> Export</button>
      }
    >
      <div className="glass mb-4 inline-flex items-center gap-2 rounded-xl p-2">
        <span className="px-2 text-sm font-semibold">Date:</span>
        <input type="date" className="rounded-lg border bg-white/70 px-3 py-1.5 text-sm" value={day} onChange={(e) => setDay(e.target.value)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total Income" value={totalInc} icon={TrendingUp} tone="success" />
        <KpiCard label="Total Expense" value={totalExp} icon={TrendingDown} tone="destructive" />
        <KpiCard label="Net Profit" value={totalInc - totalExp} icon={Activity} tone={totalInc - totalExp >= 0 ? "primary" : "destructive"} />
        <KpiCard label="Closing Balance" value={totalBalance} icon={Wallet} tone="turquoise" hint="All accounts" />
      </div>

      <h2 className="mt-6 mb-3 font-bold">Branch performance — {fmtDate(day)}</h2>
      <div className="glass overflow-hidden rounded-2xl">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-3 border-b border-border/50 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          <span>Branch</span><span className="text-right">Income</span><span className="text-right">Expense</span><span className="text-right">Profit</span>
        </div>
        <div className="divide-y divide-border/50">
          {byBranch.map((r) => (
            <div key={r.name} className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-3 px-4 py-2.5 text-sm">
              <span className="truncate font-semibold">{r.name}</span>
              <span className="text-right text-emerald-600">{inr(r.income)}</span>
              <span className="text-right text-rose-600">{inr(r.expense)}</span>
              <span className="text-right font-bold">{inr(r.income - r.expense)}</span>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

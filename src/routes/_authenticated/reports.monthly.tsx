import { createFileRoute } from "@tanstack/react-router";
import { RequireRole } from "@/components/RequireRole";
import { ADMIN_ROLES } from "@/lib/permissions";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { KpiCard } from "@/components/KpiCard";
import { fetchAccounts, fetchBranches, fetchExpenses, fetchExpenseCategories, fetchIncome, fetchIncomeCategories } from "@/lib/db";
import { inr, monthLabel } from "@/lib/format";
import { exportToExcel } from "@/lib/csv";
import { useAuth } from "@/hooks/useAuth";
import { isAdmin as isAdminFn } from "@/lib/permissions";
import { Download, TrendingUp, TrendingDown, Activity, Wallet } from "lucide-react";
import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, CartesianGrid, Tooltip, Legend } from "recharts";

export const Route = createFileRoute("/_authenticated/reports/monthly")({
  head: () => ({ meta: [{ title: "Monthly Report — CSC Computer Education" }] }),
  component: function MonthlyReportGated() { return <RequireRole roles={ADMIN_ROLES}><MonthlyReport /></RequireRole>; },
});

function MonthlyReport() {
  const { roles } = useAuth();
  const admin = isAdminFn(roles);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const ym = `${year}-${String(month).padStart(2, "0")}`;

  const accounts = useQuery({ queryKey: ["accounts"], queryFn: fetchAccounts });
  const branches = useQuery({ queryKey: ["branches"], queryFn: fetchBranches });
  const inc = useQuery({ queryKey: ["income"], queryFn: () => fetchIncome(2000) });
  const exp = useQuery({ queryKey: ["expenses"], queryFn: () => fetchExpenses(2000) });
  const incCats = useQuery({ queryKey: ["incCats"], queryFn: fetchIncomeCategories });
  const expCats = useQuery({ queryKey: ["expCats"], queryFn: fetchExpenseCategories });

  // For non-admins, never display personal categories at all.
  const visibleExpCats = (expCats.data ?? []).filter((c) => admin || !c.is_personal);
  const visibleExpCatIds = new Set(visibleExpCats.map((c) => c.id));

  const incFilt = (inc.data ?? []).filter((r) => r.txn_date.startsWith(ym));
  const expFilt = (exp.data ?? []).filter(
    (r) => r.txn_date.startsWith(ym) && (!r.category_id || visibleExpCatIds.has(r.category_id)),
  );
  const totalInc = incFilt.reduce((a, r) => a + Number(r.amount), 0);
  const totalExp = expFilt.reduce((a, r) => a + Number(r.amount), 0);

  const daysInMonth = new Date(year, month, 0).getDate();
  const dailySeries = Array.from({ length: daysInMonth }, (_, i) => {
    const d = String(i + 1).padStart(2, "0");
    const key = `${ym}-${d}`;
    return {
      day: i + 1,
      income: incFilt.filter((r) => r.txn_date === key).reduce((a, r) => a + Number(r.amount), 0),
      expense: expFilt.filter((r) => r.txn_date === key).reduce((a, r) => a + Number(r.amount), 0),
    };
  });

  const branchRows = (branches.data ?? []).map((b) => ({
    branch: b.name,
    income: incFilt.filter((r) => r.branch_id === b.id).reduce((a, r) => a + Number(r.amount), 0),
    expense: expFilt.filter((r) => r.branch_id === b.id).reduce((a, r) => a + Number(r.amount), 0),
  })).sort((a, b) => a.branch.localeCompare(b.branch));

  const incCatRows = (incCats.data ?? [])
    .map((c) => ({ name: c.name, total: incFilt.filter((r) => r.category_id === c.id).reduce((a, r) => a + Number(r.amount), 0) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const expCatRows = visibleExpCats
    .map((c) => ({ name: c.name, total: expFilt.filter((r) => r.category_id === c.id).reduce((a, r) => a + Number(r.amount), 0) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const totalBalance = (accounts.data ?? []).reduce((a, r) => a + Number(r.current_balance), 0);

  return (
    <AppShell
      title="Monthly Report"
      action={
        <button
          onClick={() => exportToExcel(`monthly-${ym}.xlsx`, branchRows.map((b) => ({ Branch: b.branch, Income: b.income, Expense: b.expense, Profit: b.income - b.expense })))}
          className="inline-flex items-center gap-1.5 rounded-xl border bg-white/70 px-3 py-2 text-sm font-semibold"
        ><Download className="h-4 w-4" /> Export</button>
      }
    >
      <div className="glass mb-4 inline-flex items-center gap-2 rounded-xl p-2">
        <select className="rounded-lg border bg-white/70 px-3 py-1.5 text-sm" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
          {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{monthLabel(i + 1)}</option>)}
        </select>
        <input type="number" className="w-24 rounded-lg border bg-white/70 px-3 py-1.5 text-sm" value={year} onChange={(e) => setYear(Number(e.target.value))} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Monthly Income" value={totalInc} icon={TrendingUp} tone="success" />
        <KpiCard label="Monthly Expense" value={totalExp} icon={TrendingDown} tone="destructive" />
        <KpiCard label="Net Profit" value={totalInc - totalExp} icon={Activity} tone="primary" />
        <KpiCard label="Account Balances" value={totalBalance} icon={Wallet} tone="turquoise" />
      </div>

      <div className="glass mt-6 rounded-2xl p-5">
        <h2 className="mb-3 font-bold">Daily Cash Flow — {monthLabel(month)} {year}</h2>
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={dailySeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e133" />
              <XAxis dataKey="day" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} />
              <Tooltip formatter={(v: number) => inr(v)} />
              <Legend />
              <Bar dataKey="income" fill="#00CFFF" radius={[5,5,0,0]} />
              <Bar dataKey="expense" fill="#F43F5E" radius={[5,5,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="glass rounded-2xl p-5">
          <h2 className="mb-3 font-bold">Income by Category</h2>
          <div className="space-y-2">
            {incCatRows.map((r) => (
              <div key={r.name} className="flex items-center justify-between rounded-lg bg-white/40 px-3 py-2 text-sm">
                <span className="truncate font-semibold">{r.name}</span>
                <span className="text-emerald-600">{inr(r.total)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="glass rounded-2xl p-5">
          <h2 className="mb-3 font-bold">Expense by Category</h2>
          <div className="space-y-2">
            {expCatRows.map((r) => (
              <div key={r.name} className="flex items-center justify-between rounded-lg bg-white/40 px-3 py-2 text-sm">
                <span className="truncate font-semibold">{r.name}</span>
                <span className="text-rose-600">{inr(r.total)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <h2 className="mt-6 mb-3 font-bold">Branch P&L</h2>
      <div className="glass overflow-hidden rounded-2xl">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-3 border-b border-border/50 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          <span>Branch</span><span className="text-right">Income</span><span className="text-right">Expense</span><span className="text-right">Profit</span>
        </div>
        <div className="divide-y divide-border/50">
          {branchRows.map((r) => (
            <div key={r.branch} className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-3 px-4 py-2.5 text-sm">
              <span className="truncate font-semibold">{r.branch}</span>
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

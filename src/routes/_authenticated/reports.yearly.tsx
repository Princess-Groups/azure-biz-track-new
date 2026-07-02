import { createFileRoute } from "@tanstack/react-router";
import { RequireRole } from "@/components/RequireRole";
import { ADMIN_ROLES } from "@/lib/permissions";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { KpiCard } from "@/components/KpiCard";
import { fetchBranches, fetchExpenses, fetchIncome } from "@/lib/db";
import { inr, monthLabel } from "@/lib/format";
import { exportToExcel } from "@/lib/csv";
import { Download, TrendingUp, TrendingDown, Activity, BarChart3 } from "lucide-react";
import { useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip, Legend,
} from "recharts";

export const Route = createFileRoute("/_authenticated/reports/yearly")({
  head: () => ({ meta: [{ title: "Yearly Report — CSC Computer Education" }] }),
  component: function YearlyReportGated() { return <RequireRole roles={ADMIN_ROLES}><YearlyReport /></RequireRole>; },
});

function YearlyReport() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [prevYear, setPrevYear] = useState(now.getFullYear() - 1);
  const inc = useQuery({ queryKey: ["income"], queryFn: () => fetchIncome(5000) });
  const exp = useQuery({ queryKey: ["expenses"], queryFn: () => fetchExpenses(5000) });
  const branches = useQuery({ queryKey: ["branches"], queryFn: fetchBranches });

  const yearSum = (yr: number, list: { txn_date: string; amount: number }[]) =>
    list.filter((r) => r.txn_date.startsWith(String(yr))).reduce((a, r) => a + Number(r.amount), 0);

  const ti = yearSum(year, inc.data ?? []);
  const te = yearSum(year, exp.data ?? []);
  const pti = yearSum(prevYear, inc.data ?? []);
  const pte = yearSum(prevYear, exp.data ?? []);

  const monthly = Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, "0");
    const ymCur = `${year}-${m}`;
    const ymPrev = `${prevYear}-${m}`;
    return {
      month: monthLabel(i + 1),
      income: (inc.data ?? []).filter((r) => r.txn_date.startsWith(ymCur)).reduce((a, r) => a + Number(r.amount), 0),
      expense: (exp.data ?? []).filter((r) => r.txn_date.startsWith(ymCur)).reduce((a, r) => a + Number(r.amount), 0),
      prevIncome: (inc.data ?? []).filter((r) => r.txn_date.startsWith(ymPrev)).reduce((a, r) => a + Number(r.amount), 0),
    };
  });

  const branchGrowth = (branches.data ?? []).map((b) => {
    const cur = (inc.data ?? []).filter((r) => r.branch_id === b.id && r.txn_date.startsWith(String(year))).reduce((a, r) => a + Number(r.amount), 0);
    const prev = (inc.data ?? []).filter((r) => r.branch_id === b.id && r.txn_date.startsWith(String(prevYear))).reduce((a, r) => a + Number(r.amount), 0);
    const growth = prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : 0;
    return { name: b.name, cur, prev, growth };
  });

  const yoyChange = pti > 0 ? ((ti - pti) / pti) * 100 : 0;

  return (
    <AppShell
      title="Yearly Report"
      action={
        <button
          onClick={() => exportToExcel(`yearly-${year}.xlsx`, monthly.map((m) => ({ Month: m.month, Income: m.income, Expense: m.expense, Profit: m.income - m.expense })))}
          className="inline-flex items-center gap-1.5 rounded-xl border bg-white/70 px-3 py-2 text-sm font-semibold"
        ><Download className="h-4 w-4" /> Export</button>
      }
    >
      <div className="glass mb-4 inline-flex items-center gap-3 rounded-xl p-2">
        <label className="text-sm font-semibold">Year:</label>
        <input type="number" className="w-24 rounded-lg border bg-white/70 px-3 py-1.5 text-sm" value={year} onChange={(e) => setYear(Number(e.target.value))} />
        <label className="text-sm font-semibold">Compare with:</label>
        <input type="number" className="w-24 rounded-lg border bg-white/70 px-3 py-1.5 text-sm" value={prevYear} onChange={(e) => setPrevYear(Number(e.target.value))} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={`${year} Income`} value={ti} icon={TrendingUp} tone="success" hint={`${yoyChange >= 0 ? "+" : ""}${yoyChange.toFixed(1)}% YoY`} />
        <KpiCard label={`${year} Expense`} value={te} icon={TrendingDown} tone="destructive" />
        <KpiCard label={`${year} Profit`} value={ti - te} icon={Activity} tone="primary" />
        <KpiCard label={`${prevYear} Profit`} value={pti - pte} icon={BarChart3} tone="turquoise" hint="Prior year" />
      </div>

      <div className="glass mt-6 rounded-2xl p-5">
        <h2 className="mb-3 font-bold">Revenue Trend — {year}</h2>
        <div className="h-72">
          <ResponsiveContainer>
            <AreaChart data={monthly}>
              <defs>
                <linearGradient id="yInc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00CFFF" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#00CFFF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e133" />
              <XAxis dataKey="month" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} />
              <Tooltip formatter={(v: number) => inr(v)} />
              <Legend />
              <Area type="monotone" dataKey="income" stroke="#00CFFF" strokeWidth={2} fill="url(#yInc)" />
              <Area type="monotone" dataKey="prevIncome" stroke="#8B5CF6" strokeWidth={2} fill="transparent" name={`${prevYear} income`} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass mt-6 rounded-2xl p-5">
        <h2 className="mb-3 font-bold">P&L by Month</h2>
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e133" />
              <XAxis dataKey="month" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} />
              <Tooltip formatter={(v: number) => inr(v)} />
              <Legend />
              <Bar dataKey="income" fill="#00CFFF" radius={[5,5,0,0]} />
              <Bar dataKey="expense" fill="#F43F5E" radius={[5,5,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <h2 className="mt-6 mb-3 font-bold">Branch Growth — {year} vs {prevYear}</h2>
      <div className="glass overflow-hidden rounded-2xl">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-3 border-b border-border/50 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          <span>Branch</span><span className="text-right">{prevYear}</span><span className="text-right">{year}</span><span className="text-right">Growth</span>
        </div>
        <div className="divide-y divide-border/50">
          {branchGrowth.map((r) => (
            <div key={r.name} className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-3 px-4 py-2.5 text-sm">
              <span className="truncate font-semibold">{r.name}</span>
              <span className="text-right">{inr(r.prev)}</span>
              <span className="text-right">{inr(r.cur)}</span>
              <span className={`text-right font-bold ${r.growth >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {r.growth >= 0 ? "+" : ""}{r.growth.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

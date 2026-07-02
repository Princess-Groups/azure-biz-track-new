import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { isAdmin } from "@/lib/permissions";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { KpiCard } from "@/components/KpiCard";
import { BankBadge } from "@/components/BankBadge";
import { CategoryIcon } from "@/components/CategoryIcon";
import {
  fetchAccounts, fetchIncome, fetchExpenses, fetchTransfers, fetchIncomeCategories, fetchExpenseCategories, fetchBranches,
} from "@/lib/db";
import { inr, monthLabel } from "@/lib/format";
import {
  TrendingUp, TrendingDown, Wallet, PiggyBank, Calendar, BarChart3, Activity, Sparkles,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, Legend, PieChart, Pie, Cell,
} from "recharts";
import { useMemo } from "react";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "Dashboard — CSC Computer Education" }] }),
  component: DashboardGate,
});

function DashboardGate() {
  const { roles, loading } = useAuth();
  if (loading) return null;
  if (!isAdmin(roles)) return <Navigate to="/income" replace />;
  return <Dashboard />;
}

function Dashboard() {
  const accounts = useQuery({ queryKey: ["accounts"], queryFn: fetchAccounts });
  const income = useQuery({ queryKey: ["income"], queryFn: () => fetchIncome(1000) });
  const expenses = useQuery({ queryKey: ["expenses"], queryFn: () => fetchExpenses(1000) });
  const transfers = useQuery({ queryKey: ["transfers"], queryFn: () => fetchTransfers(200) });
  const incCats = useQuery({ queryKey: ["incCats"], queryFn: fetchIncomeCategories });
  const expCats = useQuery({ queryKey: ["expCats"], queryFn: fetchExpenseCategories });
  const branches = useQuery({ queryKey: ["branches"], queryFn: fetchBranches });

  const today = new Date().toISOString().slice(0, 10);
  const ym = today.slice(0, 7);
  const yr = today.slice(0, 4);

  const sum = (arr: { amount: number }[]) => arr.reduce((a, r) => a + Number(r.amount), 0);

  const stats = useMemo(() => {
    const inc = income.data ?? [];
    const exp = expenses.data ?? [];
    const todayInc = sum(inc.filter((r) => r.txn_date === today));
    const todayExp = sum(exp.filter((r) => r.txn_date === today));
    const monthInc = sum(inc.filter((r) => r.txn_date.startsWith(ym)));
    const monthExp = sum(exp.filter((r) => r.txn_date.startsWith(ym)));
    const yearInc = sum(inc.filter((r) => r.txn_date.startsWith(yr)));
    const yearExp = sum(exp.filter((r) => r.txn_date.startsWith(yr)));
    return { todayInc, todayExp, monthInc, monthExp, yearInc, yearExp };
  }, [income.data, expenses.data, today, ym, yr]);

  const totalBalance = (accounts.data ?? []).reduce((a, r) => a + Number(r.current_balance), 0);

  // Last 30 days income vs expense
  const dailySeries = useMemo(() => {
    const days: { date: string; income: number; expense: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const k = d.toISOString().slice(0, 10);
      days.push({
        date: `${d.getDate()}/${d.getMonth() + 1}`,
        income: sum((income.data ?? []).filter((r) => r.txn_date === k)),
        expense: sum((expenses.data ?? []).filter((r) => r.txn_date === k)),
      });
    }
    return days;
  }, [income.data, expenses.data]);

  // Monthly series for current year
  const monthlySeries = useMemo(() => {
    const months: { month: string; income: number; expense: number; profit: number }[] = [];
    for (let m = 1; m <= 12; m++) {
      const ymk = `${yr}-${String(m).padStart(2, "0")}`;
      const inc = sum((income.data ?? []).filter((r) => r.txn_date.startsWith(ymk)));
      const exp = sum((expenses.data ?? []).filter((r) => r.txn_date.startsWith(ymk)));
      months.push({ month: monthLabel(m), income: inc, expense: exp, profit: inc - exp });
    }
    return months;
  }, [income.data, expenses.data, yr]);

  // Branch performance (this month)
  const branchPerf = useMemo(() => {
    const list = branches.data ?? [];
    return list.map((b) => ({
      name: b.name.replace(" Branch", ""),
      income: sum((income.data ?? []).filter((r) => r.branch_id === b.id && r.txn_date.startsWith(ym))),
      expense: sum((expenses.data ?? []).filter((r) => r.branch_id === b.id && r.txn_date.startsWith(ym))),
    }));
  }, [branches.data, income.data, expenses.data, ym]);

  // Payment mode pie
  const paymentMode = useMemo(() => {
    const inc = income.data ?? [];
    const modes = ["cash", "gpay", "bank_transfer"] as const;
    return modes.map((m) => ({
      name: m === "gpay" ? "GPay" : m === "cash" ? "Cash" : "Bank Transfer",
      value: sum(inc.filter((r) => r.payment_mode === m && r.txn_date.startsWith(ym))),
    }));
  }, [income.data, ym]);

  const PIE_COLORS = ["#00CFFF", "#00D4C4", "#8B5CF6"];

  // Recent transactions
  const recent = useMemo(() => {
    const inc = (income.data ?? []).map((r) => ({ kind: "income" as const, ...r }));
    const exp = (expenses.data ?? []).map((r) => ({ kind: "expense" as const, ...r }));
    return [...inc, ...exp]
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, 8);
  }, [income.data, expenses.data]);

  const incCatMap = new Map((incCats.data ?? []).map((c) => [c.id, c] as const));
  const expCatMap = new Map((expCats.data ?? []).map((c) => [c.id, c] as const));
  const branchMap = new Map((branches.data ?? []).map((b) => [b.id, b] as const));

  return (
    <AppShell title="Dashboard">
      {/* KPI grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total Account Balance" value={totalBalance} icon={PiggyBank} tone="primary" hint={`Opening + Income − Expenses · ${accounts.data?.length ?? 0} accounts`} />
        <KpiCard label="Today's Profit" value={stats.todayInc - stats.todayExp} icon={Activity} tone={stats.todayInc - stats.todayExp >= 0 ? "success" : "destructive"} hint={`Income ${inr(stats.todayInc)} · Expense ${inr(stats.todayExp)}`} />
        <KpiCard label="Monthly Profit" value={stats.monthInc - stats.monthExp} icon={Calendar} tone="turquoise" hint={`${monthLabel(new Date().getMonth() + 1)} ${yr}`} />
        <KpiCard label="Yearly Profit" value={stats.yearInc - stats.yearExp} icon={BarChart3} tone="warning" hint={`Year ${yr}`} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <KpiCard label="Today's Income" value={stats.todayInc} icon={TrendingUp} tone="success" />
        <KpiCard label="Today's Expense" value={stats.todayExp} icon={TrendingDown} tone="destructive" />
        <KpiCard label="Cash on Hand" value={(accounts.data ?? []).find((a) => a.bank === "cash")?.current_balance ?? 0} icon={Wallet} tone="warning" />
      </div>

      {/* Charts */}
      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <div className="glass rounded-2xl p-5 xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">Last 30 days — Income vs Expense</h2>
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={dailySeries}>
                <defs>
                  <linearGradient id="gInc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00CFFF" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#00CFFF" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F43F5E" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#F43F5E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e133" />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => (v >= 1000 ? `${(v/1000).toFixed(0)}k` : v)} />
                <Tooltip formatter={(v: number) => inr(v)} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }} />
                <Area type="monotone" dataKey="income" stroke="#00CFFF" strokeWidth={2} fill="url(#gInc)" />
                <Area type="monotone" dataKey="expense" stroke="#F43F5E" strokeWidth={2} fill="url(#gExp)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <h2 className="mb-3 font-bold">Payment Mode (This month)</h2>
          <div className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={paymentMode} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                  {paymentMode.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => inr(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="glass rounded-2xl p-5 xl:col-span-2">
          <h2 className="mb-3 font-bold">Monthly Trend — {yr}</h2>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={monthlySeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e133" />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => (v >= 1000 ? `${(v/1000).toFixed(0)}k` : v)} />
                <Tooltip formatter={(v: number) => inr(v)} contentStyle={{ borderRadius: 12 }} />
                <Legend />
                <Bar dataKey="income" fill="#00CFFF" radius={[6,6,0,0]} />
                <Bar dataKey="expense" fill="#F43F5E" radius={[6,6,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <h2 className="mb-3 font-bold">Branch Performance (Month)</h2>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={branchPerf} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e133" />
                <XAxis type="number" fontSize={11} tickFormatter={(v) => (v >= 1000 ? `${(v/1000).toFixed(0)}k` : v)} />
                <YAxis dataKey="name" type="category" fontSize={11} width={80} />
                <Tooltip formatter={(v: number) => inr(v)} />
                <Bar dataKey="income" fill="#00D4C4" radius={[0,6,6,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Accounts strip */}
      <div className="mt-6">
        <h2 className="mb-3 font-bold">Account Balances</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {(accounts.data ?? []).map((a) => (
            <div key={a.id} className="glass flex items-center gap-3 rounded-2xl p-4">
              <BankBadge bank={a.bank as never} color={a.color} size={42} />
              <div className="min-w-0">
                <p className="truncate text-xs text-muted-foreground">{a.name}</p>
                <p className="truncate text-base font-bold">{inr(a.current_balance)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent transactions */}
      <div className="glass mt-6 rounded-2xl p-5">
        <h2 className="mb-3 font-bold">Recent Activity</h2>
        <div className="divide-y divide-border/50">
          {recent.map((r) => {
            const cat = r.kind === "income" ? incCatMap.get(r.category_id ?? "") : expCatMap.get(r.category_id ?? "");
            const branch = branchMap.get(r.branch_id ?? "");
            return (
              <div key={`${r.kind}-${r.id}`} className="flex items-center gap-3 py-3">
                <CategoryIcon name={cat?.icon} color={cat?.color ?? (r.kind === "income" ? "#00CFFF" : "#F43F5E")} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{cat?.name ?? (r.kind === "income" ? "Income" : "Expense")}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.txn_date} · {branch?.name ?? "—"} · {r.payment_mode.replace("_", " ")}
                  </p>
                </div>
                <p className={`shrink-0 text-sm font-bold ${r.kind === "income" ? "text-emerald-600" : "text-rose-600"}`}>
                  {r.kind === "income" ? "+" : "−"} {inr(r.amount)}
                </p>
              </div>
            );
          })}
          {!recent.length && <p className="py-8 text-center text-sm text-muted-foreground">No transactions yet. Add your first income or expense to get started.</p>}
        </div>
      </div>
    </AppShell>
  );
}

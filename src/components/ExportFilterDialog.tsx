import { useMemo, useState } from "react";
import { X, Download } from "lucide-react";
import type { Account, Branch, Category, Expense, Income } from "@/lib/db";
import { exportToCSV } from "@/lib/csv";
import { fmtDate } from "@/lib/format";

export type TxnType = "business_income" | "personal_income" | "business_expense" | "personal_expense";
export type PayMode = "cash" | "gpay" | "bank_transfer" | "cheque";

const ALL_TYPES: { value: TxnType; label: string }[] = [
  { value: "business_income", label: "Business Income" },
  { value: "personal_income", label: "Personal Income" },
  { value: "business_expense", label: "Business Expense" },
  { value: "personal_expense", label: "Personal Expense" },
];
const ALL_MODES: PayMode[] = ["cash", "gpay", "bank_transfer", "cheque"];

export function ExportFilterDialog({
  onClose,
  income, expenses,
  incomeCats, expenseCats,
  branches, accounts,
}: {
  onClose: () => void;
  income: Income[];
  expenses: Expense[];
  incomeCats: Category[];
  expenseCats: Category[];
  branches: Branch[];
  accounts: Account[];
}) {
  const [types, setTypes] = useState<TxnType[]>(ALL_TYPES.map((t) => t.value));
  const [categoryId, setCategoryId] = useState<string>("");
  const [modes, setModes] = useState<PayMode[]>(["cash", "gpay", "bank_transfer"]);
  const [branchId, setBranchId] = useState<string>("");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const catMap = useMemo(
    () => new Map([...incomeCats, ...expenseCats].map((c) => [c.id, c] as const)),
    [incomeCats, expenseCats],
  );
  const branchMap = useMemo(() => new Map(branches.map((b) => [b.id, b] as const)), [branches]);
  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a] as const)), [accounts]);

  // Category options filtered by chosen types
  const catOptions = useMemo(() => {
    const wantBizInc = types.includes("business_income");
    const wantPerInc = types.includes("personal_income");
    const wantBizExp = types.includes("business_expense");
    const wantPerExp = types.includes("personal_expense");
    const out: { id: string; name: string; group: string }[] = [];
    for (const c of incomeCats) {
      const isPersonal = !!c.is_personal;
      if ((isPersonal && wantPerInc) || (!isPersonal && wantBizInc))
        out.push({ id: c.id, name: c.name, group: isPersonal ? "Personal Income" : "Business Income" });
    }
    for (const c of expenseCats) {
      const isPersonal = !!c.is_personal;
      if ((isPersonal && wantPerExp) || (!isPersonal && wantBizExp))
        out.push({ id: c.id, name: c.name, group: isPersonal ? "Personal Expense" : "Business Expense" });
    }
    return out.sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
  }, [types, incomeCats, expenseCats]);

  const toggleType = (t: TxnType) =>
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  const toggleMode = (m: PayMode) =>
    setModes((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));

  function handleExport() {
    const inDate = (d: string) => (!from || d >= from) && (!to || d <= to);
    const rows: Record<string, string | number>[] = [];

    const wantBizInc = types.includes("business_income");
    const wantPerInc = types.includes("personal_income");
    const wantBizExp = types.includes("business_expense");
    const wantPerExp = types.includes("personal_expense");

    for (const r of income) {
      const c = r.category_id ? catMap.get(r.category_id) : undefined;
      const isPersonal = !!c?.is_personal;
      const ok = isPersonal ? wantPerInc : wantBizInc;
      if (!ok) continue;
      if (categoryId && r.category_id !== categoryId) continue;
      if (branchId && r.branch_id !== branchId) continue;
      if (modes.length && !modes.includes(r.payment_mode as PayMode)) continue;
      if (!inDate(r.txn_date)) continue;
      rows.push({
        Type: isPersonal ? "Personal Income" : "Business Income",
        Date: fmtDate(r.txn_date),
        Category: c?.name ?? "",
        Name: r.notes ?? "",
        Branch: branchMap.get(r.branch_id ?? "")?.name ?? "",
        Account: accountMap.get(r.account_id ?? "")?.name ?? "",
        "Payment Mode": r.payment_mode,
        Amount: Number(r.amount),
      });
    }
    for (const r of expenses) {
      const c = r.category_id ? catMap.get(r.category_id) : undefined;
      const isPersonal = !!c?.is_personal;
      const ok = isPersonal ? wantPerExp : wantBizExp;
      if (!ok) continue;
      if (categoryId && r.category_id !== categoryId) continue;
      if (branchId && r.branch_id !== branchId) continue;
      if (modes.length && !modes.includes(r.payment_mode as PayMode)) continue;
      if (!inDate(r.txn_date)) continue;
      rows.push({
        Type: isPersonal ? "Personal Expense" : "Business Expense",
        Date: fmtDate(r.txn_date),
        Category: c?.name ?? "",
        Name: r.description ?? "",
        Branch: branchMap.get(r.branch_id ?? "")?.name ?? "",
        Account: accountMap.get(r.account_id ?? "")?.name ?? "",
        "Payment Mode": r.payment_mode,
        Amount: Number(r.amount),
      });
    }
    rows.sort((a, b) => String(a.Date).localeCompare(String(b.Date)));
    if (!rows.length) {
      alert("No records match the selected filters.");
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    exportToCSV(`transactions-filtered-${stamp}.csv`, rows);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4 flex items-start justify-center">
      <div className="glass w-full max-w-2xl rounded-2xl border bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Advanced Export</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          {/* Step 1 — Type */}
          <section>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Step 1 · Transaction Type</p>
            <div className="flex flex-wrap gap-2">
              {ALL_TYPES.map((t) => (
                <label key={t.value} className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-1.5 text-sm ${types.includes(t.value) ? "border-primary bg-primary/10" : "bg-white/60"}`}>
                  <input type="checkbox" checked={types.includes(t.value)} onChange={() => toggleType(t.value)} className="h-4 w-4" />
                  {t.label}
                </label>
              ))}
            </div>
          </section>

          {/* Step 2 — Category */}
          <section>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Step 2 · Category</p>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full rounded-xl border bg-white/70 px-3 py-2 text-sm">
              <option value="">All Categories</option>
              {catOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.group} — {c.name}</option>
              ))}
            </select>
          </section>

          {/* Step 3 — Payment Mode */}
          <section>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Step 3 · Payment Mode (multi-select)</p>
            <div className="flex flex-wrap gap-2">
              {ALL_MODES.map((m) => (
                <label key={m} className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-1.5 text-sm capitalize ${modes.includes(m) ? "border-primary bg-primary/10" : "bg-white/60"}`}>
                  <input type="checkbox" checked={modes.includes(m)} onChange={() => toggleMode(m)} className="h-4 w-4" />
                  {m.replace("_", " ")}
                </label>
              ))}
            </div>
          </section>

          {/* Step 4 — Branch */}
          <section>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Step 4 · Branch</p>
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-full rounded-xl border bg-white/70 px-3 py-2 text-sm">
              <option value="">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </section>

          {/* Step 5 — Date range */}
          <section>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Step 5 · Date Range</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs">
                <span className="mb-1 block text-muted-foreground">From</span>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full rounded-xl border bg-white/70 px-3 py-2 text-sm" />
              </label>
              <label className="text-xs">
                <span className="mb-1 block text-muted-foreground">To</span>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full rounded-xl border bg-white/70 px-3 py-2 text-sm" />
              </label>
            </div>
          </section>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border bg-white/70 px-4 py-2 text-sm font-semibold">Cancel</button>
          <button onClick={handleExport} className="inline-flex items-center gap-1.5 rounded-xl gradient-sky px-4 py-2 text-sm font-semibold text-white shadow-md">
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>
    </div>
  );
}

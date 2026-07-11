import { CategoryIcon } from "./CategoryIcon";
import { inr } from "@/lib/format";
import type { Category } from "@/lib/db";

type Row = { category_id: string | null; amount: number };

export function CategoryTotals({
  categories,
  rows,
  tone = "income",
}: {
  categories: Category[];
  rows: Row[];
  tone?: "income" | "expense";
}) {
  const totals = new Map<string, number>();
  for (const r of rows) {
    if (!r.category_id) continue;
    totals.set(r.category_id, (totals.get(r.category_id) ?? 0) + Number(r.amount || 0));
  }
  const cards = categories
    .map((c) => ({ c, total: totals.get(c.id) ?? 0 }))
    .sort((a, b) => b.total - a.total);

  if (!cards.length) return null;

  const amountClass = tone === "income" ? "text-emerald-600" : "text-rose-600";

  return (
    <div className="mb-4 -mx-1 flex gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
      {cards.map(({ c, total }) => (
        <div
          key={c.id}
          className="glass group flex min-w-[160px] shrink-0 items-center gap-3 rounded-2xl p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
          style={{ borderColor: `${c.color}33` }}
        >
          <CategoryIcon name={c.icon} color={c.color} size={40} title={c.name} />
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {c.name}
            </p>
            <p className={`truncate text-sm font-bold ${amountClass}`}>{inr(total)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

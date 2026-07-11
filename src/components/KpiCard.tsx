import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { inr } from "@/lib/format";

export function KpiCard({
  label,
  value,
  icon: Icon,
  tone = "primary",
  hint,
  format = "currency",
}: {
  label: string;
  value: number | string;
  icon: LucideIcon;
  tone?: "primary" | "turquoise" | "success" | "destructive" | "warning";
  hint?: string;
  format?: "currency" | "number" | "raw";
}) {
  const toneMap: Record<string, string> = {
    primary: "from-[#00CFFF] to-[#3B82F6]",
    turquoise: "from-[#00D4C4] to-[#06B6D4]",
    success: "from-emerald-400 to-teal-500",
    destructive: "from-rose-400 to-red-500",
    warning: "from-amber-400 to-orange-500",
  };
  const display =
    format === "currency" && typeof value === "number"
      ? inr(value)
      : format === "number" && typeof value === "number"
        ? value.toLocaleString("en-IN")
        : String(value);
  return (
    <div className="glass relative overflow-hidden rounded-2xl p-5">
      <div className={cn("absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br opacity-30 blur-2xl", toneMap[tone])} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-2 truncate text-2xl font-bold text-foreground">{display}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white shadow-md", toneMap[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

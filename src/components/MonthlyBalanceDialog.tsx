import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { inr } from "@/lib/format";
import { X, CalendarRange } from "lucide-react";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

export function MonthlyBalanceDialog({
  accountId,
  accountName,
  onClose,
}: {
  accountId: string;
  accountName: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [opening, setOpening] = useState("");
  const [closing, setClosing] = useState("");

  const existing = useQuery({
    queryKey: ["monthly-balance", accountId, year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_balances")
        .select("*")
        .eq("account_id", accountId)
        .eq("year", year)
        .eq("month", month)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (existing.data) {
      setOpening(String(existing.data.opening_balance ?? ""));
      setClosing(existing.data.closing_balance == null ? "" : String(existing.data.closing_balance));
    } else {
      setOpening("");
      setClosing("");
    }
  }, [existing.data, year, month]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        account_id: accountId,
        year,
        month,
        opening_balance: Number(opening || 0),
        closing_balance: closing === "" ? null : Number(closing),
      };
      if (existing.data?.id) {
        const { error } = await supabase
          .from("monthly_balances")
          .update(payload)
          .eq("id", existing.data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("monthly_balances").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Monthly balance saved");
      qc.invalidateQueries({ queryKey: ["monthly-balance", accountId] });
      qc.invalidateQueries({ queryKey: ["monthly-balance-current", accountId] });
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const years = Array.from({ length: 7 }, (_, i) => now.getFullYear() - 3 + i);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4 backdrop-blur-sm">
      <div className="glass w-full max-w-md rounded-2xl p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <CalendarRange className="h-3.5 w-3.5" /> Monthly Balance
            </div>
            <h2 className="mt-1 text-lg font-bold">{accountName}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-white/60">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="text-xs font-semibold text-muted-foreground">
            Month
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border bg-white/70 px-3 py-2 text-sm font-normal text-foreground"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-muted-foreground">
            Year
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border bg-white/70 px-3 py-2 text-sm font-normal text-foreground"
            >
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block text-xs font-semibold text-muted-foreground">
            Opening Balance (start of month)
            <input
              type="number"
              step="0.01"
              value={opening}
              onChange={(e) => setOpening(e.target.value)}
              placeholder="0.00"
              className="mt-1 w-full rounded-xl border bg-white/70 px-3 py-2 text-sm font-normal text-foreground"
            />
          </label>
          <label className="block text-xs font-semibold text-muted-foreground">
            Closing Balance (end of month)
            <input
              type="number"
              step="0.01"
              value={closing}
              onChange={(e) => setClosing(e.target.value)}
              placeholder="Optional"
              className="mt-1 w-full rounded-xl border bg-white/70 px-3 py-2 text-sm font-normal text-foreground"
            />
          </label>
        </div>

        {existing.data && (
          <div className="mt-3 rounded-xl bg-white/50 p-3 text-xs text-muted-foreground">
            Existing record — Opening {inr(existing.data.opening_balance)} •{" "}
            Closing {existing.data.closing_balance == null ? "—" : inr(existing.data.closing_balance)}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border bg-white/70 px-4 py-2 text-sm font-semibold">
            Cancel
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending || opening === ""}
            className="rounded-xl gradient-sky px-4 py-2 text-sm font-semibold text-white shadow-md disabled:opacity-50"
          >
            {save.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

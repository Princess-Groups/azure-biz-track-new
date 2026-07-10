import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, Wallet } from "lucide-react";

export function OpeningBalanceDialog({
  accountId,
  accountName,
  current,
  onClose,
}: {
  accountId: string;
  accountName: string;
  current: number;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [value, setValue] = useState(String(current ?? 0));

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("accounts")
        .update({ opening_balance: Number(value || 0) })
        .eq("id", accountId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Opening balance updated");
      qc.invalidateQueries({ queryKey: ["accounts"] });
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4 backdrop-blur-sm">
      <div className="glass w-full max-w-md rounded-2xl p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <Wallet className="h-3.5 w-3.5" /> Opening Balance
            </div>
            <h2 className="mt-1 text-lg font-bold">{accountName}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-white/60">
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="mt-4 block text-xs font-semibold text-muted-foreground">
          Opening Balance (₹)
          <input
            type="number"
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="mt-1 w-full rounded-xl border bg-white/70 px-3 py-2 text-sm font-normal text-foreground"
          />
        </label>
        <p className="mt-2 text-xs text-muted-foreground">
          Current Balance = Opening Balance + Total Income − Total Expenses. Updates instantly across the app.
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border bg-white/70 px-4 py-2 text-sm font-semibold">
            Cancel
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="rounded-xl gradient-sky px-4 py-2 text-sm font-semibold text-white shadow-md disabled:opacity-50"
          >
            {save.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

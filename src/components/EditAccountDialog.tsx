import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, Pencil } from "lucide-react";
import type { Account } from "@/lib/db";

const BANK_OPTIONS = ["hdfc", "kvb", "canara", "sbi", "icici", "axis", "other", "cash"] as const;

export function EditAccountDialog({ account, onClose }: { account: Account; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(account.name);
  const [bank, setBank] = useState<(typeof BANK_OPTIONS)[number]>(account.bank as never);
  const [acctNo, setAcctNo] = useState(account.account_number ?? "");
  const [opening, setOpening] = useState(String(account.opening_balance ?? 0));
  const [color, setColor] = useState(account.color);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("accounts")
        .update({
          name,
          bank,
          account_number: acctNo || null,
          opening_balance: Number(opening || 0),
          color,
        })
        .eq("id", account.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Account updated");
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
              <Pencil className="h-3.5 w-3.5" /> Edit Account
            </div>
            <h2 className="mt-1 text-lg font-bold">{account.name}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-white/60">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block text-xs font-semibold text-muted-foreground">
            Account Name
            <input className="mt-1 w-full rounded-xl border bg-white/70 px-3 py-2 text-sm font-normal text-foreground" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block text-xs font-semibold text-muted-foreground">
            Bank
            <select className="mt-1 w-full rounded-xl border bg-white/70 px-3 py-2 text-sm font-normal text-foreground" value={bank} onChange={(e) => setBank(e.target.value as never)}>
              {BANK_OPTIONS.map((b) => <option key={b} value={b}>{b.toUpperCase()}</option>)}
            </select>
          </label>
          <label className="block text-xs font-semibold text-muted-foreground">
            Account Number
            <input className="mt-1 w-full rounded-xl border bg-white/70 px-3 py-2 text-sm font-normal text-foreground" value={acctNo} onChange={(e) => setAcctNo(e.target.value)} />
          </label>
          <label className="block text-xs font-semibold text-muted-foreground">
            Opening Balance (₹)
            <input type="number" step="0.01" className="mt-1 w-full rounded-xl border bg-white/70 px-3 py-2 text-sm font-normal text-foreground" value={opening} onChange={(e) => setOpening(e.target.value)} />
          </label>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-muted-foreground">Color</label>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-16 rounded" />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border bg-white/70 px-4 py-2 text-sm font-semibold">Cancel</button>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending || !name}
            className="rounded-xl gradient-sky px-4 py-2 text-sm font-semibold text-white shadow-md disabled:opacity-50"
          >
            {save.isPending ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function DeleteAccountDialog({
  account,
  onClose,
}: {
  account: Account;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [confirmName, setConfirmName] = useState("");

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("accounts").delete().eq("id", account.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Account deleted");
      qc.invalidateQueries({ queryKey: ["accounts"] });
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const matches = confirmName.trim() === account.name;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="glass w-full max-w-md rounded-2xl border-2 border-rose-200 p-6">
        <h2 className="text-lg font-bold text-rose-700">Delete Account?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This will permanently remove <span className="font-bold text-foreground">{account.name}</span>. Existing
          transactions will keep their record but lose the account link. This action cannot be undone.
        </p>
        <label className="mt-4 block text-xs font-semibold text-muted-foreground">
          Type <span className="font-mono text-rose-600">{account.name}</span> to confirm
          <input
            className="mt-1 w-full rounded-xl border bg-white/70 px-3 py-2 text-sm font-normal text-foreground"
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={account.name}
          />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border bg-white/70 px-4 py-2 text-sm font-semibold">
            Cancel
          </button>
          <button
            onClick={() => del.mutate()}
            disabled={!matches || del.isPending}
            className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-rose-700 disabled:opacity-50"
          >
            {del.isPending ? "Deleting…" : "Delete Account"}
          </button>
        </div>
      </div>
    </div>
  );
}

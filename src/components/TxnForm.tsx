import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { todayISO } from "@/lib/format";
import { uploadAttachment, type Account, type Branch, type Category } from "@/lib/db";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";

type Mode = "income" | "expense";

export function TxnForm({
  mode,
  accounts,
  branches,
  categories,
  onClose,
}: {
  mode: Mode;
  accounts: Account[];
  branches: Branch[];
  categories: Category[];
  onClose: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [txn_date, setDate] = useState(todayISO());
  const [branch_id, setBranch] = useState<string>(branches[0]?.id ?? "");
  const [category_id, setCategory] = useState<string>(categories[0]?.id ?? "");
  const [account_id, setAccount] = useState<string>(accounts[0]?.id ?? "");
  const [payment_mode, setPM] = useState<"cash" | "gpay" | "bank_transfer">("cash");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const amt = Number(amount);
      if (!amt || amt < 0) throw new Error("Amount required");
      if (!account_id) throw new Error("Please select a bank account");
      let attachment_path: string | null = null;
      if (file) attachment_path = await uploadAttachment(user.id, file);
      const base = {
        txn_date,
        branch_id: branch_id || null,
        category_id: category_id || null,
        account_id: account_id || null,
        payment_mode,
        amount: amt,
        attachment_path,
        created_by: user.id,
      };
      if (mode === "income") {
        const { error } = await supabase
          .from("income_transactions")
          .insert({ ...base, notes: note || null });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("expense_transactions")
          .insert({ ...base, description: note || null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(`${mode === "income" ? "Income" : "Expense"} saved`);
      qc.invalidateQueries({ queryKey: [mode === "income" ? "income" : "expenses"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4 backdrop-blur-sm">
      <div className="glass w-full max-w-lg rounded-2xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Add {mode === "income" ? "Income" : "Expense"}</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/60"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Date</span>
            <input type="date" className="w-full rounded-xl border bg-white/70 px-3 py-2" value={txn_date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Amount (₹)</span>
            <input type="number" min="0" step="0.01" className="w-full rounded-xl border bg-white/70 px-3 py-2" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Branch</span>
            <select className="w-full rounded-xl border bg-white/70 px-3 py-2" value={branch_id} onChange={(e) => setBranch(e.target.value)}>
              <option value="">— none —</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Category</span>
            <select className="w-full rounded-xl border bg-white/70 px-3 py-2" value={category_id} onChange={(e) => setCategory(e.target.value)}>
              <option value="">— none —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Bank Account <span className="text-rose-500">*</span></span>
            <select required className="w-full rounded-xl border bg-white/70 px-3 py-2" value={account_id} onChange={(e) => setAccount(e.target.value)}>
              <option value="">— select account —</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Payment Mode</span>
            <select className="w-full rounded-xl border bg-white/70 px-3 py-2" value={payment_mode} onChange={(e) => setPM(e.target.value as never)}>
              <option value="cash">Cash</option>
              <option value="gpay">GPay</option>
              <option value="bank_transfer">Bank Transfer</option>
            </select>
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">{mode === "income" ? "Notes" : "Description"}</span>
            <textarea className="w-full rounded-xl border bg-white/70 px-3 py-2" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Attachment (optional)</span>
            <input type="file" accept="image/*,.pdf" className="w-full text-sm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border bg-white/70 px-4 py-2 text-sm font-semibold">Cancel</button>
          <button onClick={() => save.mutate()} disabled={save.isPending} className="inline-flex items-center gap-1.5 rounded-xl gradient-sky px-4 py-2 text-sm font-semibold text-white shadow-md disabled:opacity-50">
            <Plus className="h-4 w-4" /> {save.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

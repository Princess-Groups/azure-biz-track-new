import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { todayISO } from "@/lib/format";
import { uploadAttachment, type Account, type Branch, type Category } from "@/lib/db";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";

type Mode = "income" | "expense";

export type EditingTxn = {
  id: string;
  txn_date: string;
  branch_id: string | null;
  category_id: string | null;
  account_id: string | null;
  payment_mode: "cash" | "gpay" | "bank_transfer";
  amount: number;
  note: string | null;
};

export function TxnForm({
  mode,
  accounts,
  branches,
  categories,
  onClose,
  hideBranch = false,
  editing = null,
}: {
  mode: Mode;
  accounts: Account[];
  branches: Branch[];
  categories: Category[];
  onClose: () => void;
  hideBranch?: boolean;
  editing?: EditingTxn | null;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isEdit = !!editing;
  const [txn_date, setDate] = useState(editing?.txn_date ?? todayISO());
  const [branch_id, setBranch] = useState<string>(editing?.branch_id ?? branches[0]?.id ?? "");
  const [branchOther, setBranchOther] = useState("");
  const [category_id, setCategory] = useState<string>(editing?.category_id ?? categories[0]?.id ?? "");
  const [categoryOther, setCategoryOther] = useState("");
  const [account_id, setAccount] = useState<string>(editing?.account_id ?? accounts[0]?.id ?? "");
  const [payment_mode, setPM] = useState<"cash" | "gpay" | "bank_transfer" | "__other">(editing?.payment_mode ?? "cash");
  const [pmOther, setPmOther] = useState("");
  const [amount, setAmount] = useState(editing ? String(editing.amount) : "");
  const [note, setNote] = useState(editing?.note ?? "");
  const [file, setFile] = useState<File | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const amt = Number(amount);
      if (!amt || amt < 0) throw new Error("Amount required");
      if (!account_id) throw new Error("Please select a bank account");

      // Resolve "Others" for category → auto-create category row
      let finalCategoryId: string | null = category_id || null;
      if (category_id === "__other") {
        const name = categoryOther.trim();
        if (!name) throw new Error("Please enter the custom category name");
        const table = mode === "income" ? "income_categories" : "expense_categories";
        const existing = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
        if (existing) {
          finalCategoryId = existing.id;
        } else {
          const { data, error } = await (supabase.from(table) as unknown as { insert: (v: Record<string, unknown>) => { select: (c: string) => { single: () => Promise<{ data: { id: string } | null; error: unknown }> } } }).insert({ name, icon: "tag", color: "#94a3b8", is_active: true }).select("id").single();
          if (error) throw error;
          finalCategoryId = data?.id ?? null;
        }
      }

      // Resolve "Others" for branch → auto-create branch row
      let finalBranchId: string | null = hideBranch ? null : (branch_id || null);
      if (!hideBranch && branch_id === "__other") {
        const name = branchOther.trim();
        if (!name) throw new Error("Please enter the custom branch name");
        const existing = branches.find((b) => b.name.toLowerCase() === name.toLowerCase());
        if (existing) {
          finalBranchId = existing.id;
        } else {
          const { data, error } = await (supabase.from("branches") as unknown as { insert: (v: Record<string, unknown>) => { select: (c: string) => { single: () => Promise<{ data: { id: string } | null; error: unknown }> } } }).insert({ name, is_active: true }).select("id").single();
          if (error) throw error;
          finalBranchId = data?.id ?? null;
        }
      }

      let attachment_path: string | null | undefined = undefined;
      if (file) attachment_path = await uploadAttachment(user.id, file);

      // Payment mode: DB enum — "Others" custom text stored inline with note
      const pmFinal: "cash" | "gpay" | "bank_transfer" = payment_mode === "__other" ? "cash" : payment_mode;
      let noteFinal = note || "";
      if (payment_mode === "__other" && pmOther.trim()) {
        noteFinal = `[Payment: ${pmOther.trim()}]${noteFinal ? " " + noteFinal : ""}`;
      }

      const base: Record<string, unknown> = {
        txn_date,
        branch_id: finalBranchId,
        category_id: finalCategoryId,
        account_id: account_id || null,
        payment_mode: pmFinal,
        amount: amt,
      };
      if (attachment_path !== undefined) base.attachment_path = attachment_path;

      const table = mode === "income" ? "income_transactions" : "expense_transactions";
      const noteField = mode === "income" ? "notes" : "description";
      base[noteField] = noteFinal || null;

      if (isEdit && editing) {
        const { error } = await (supabase.from(table) as unknown as { update: (v: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<{ error: unknown }> } }).update(base).eq("id", editing.id);
        if (error) throw error;
      } else {
        base.created_by = user.id;
        const { error } = await (supabase.from(table) as unknown as { insert: (v: Record<string, unknown>) => Promise<{ error: unknown }> }).insert(base);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(`${mode === "income" ? "Income" : "Expense"} ${isEdit ? "updated" : "saved"}`);
      qc.invalidateQueries({ queryKey: [mode === "income" ? "income" : "expenses"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["branches"] });
      qc.invalidateQueries({ queryKey: ["incCats"] });
      qc.invalidateQueries({ queryKey: ["expCats"] });
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4 backdrop-blur-sm">
      <div className="glass w-full max-w-lg rounded-2xl p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{isEdit ? "Edit" : "Add"} {mode === "income" ? "Income" : "Expense"}</h2>
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
          {!hideBranch && (
            <label className="text-sm">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Branch</span>
              <SearchableSelect
                value={branch_id}
                onChange={setBranch}
                options={branches.map((b) => ({ value: b.id, label: b.name }))}
                placeholder="— none —"
              />
              {branch_id === "__other" && (
                <input
                  type="text"
                  placeholder="Enter custom branch name"
                  className="mt-2 w-full rounded-xl border bg-white/70 px-3 py-2"
                  value={branchOther}
                  onChange={(e) => setBranchOther(e.target.value)}
                />
              )}
            </label>
          )}
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Category</span>
            <SearchableSelect
              value={category_id}
              onChange={setCategory}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="— none —"
            />
            {category_id === "__other" && (
              <input
                type="text"
                placeholder="Enter custom category name"
                className="mt-2 w-full rounded-xl border bg-white/70 px-3 py-2"
                value={categoryOther}
                onChange={(e) => setCategoryOther(e.target.value)}
              />
            )}
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Bank Account <span className="text-rose-500">*</span></span>
            <SearchableSelect
              value={account_id}
              onChange={setAccount}
              options={accounts.map((a) => ({ value: a.id, label: a.name }))}
              placeholder="— select account —"
              noneLabel="— select account —"
              includeOthers={false}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Payment Mode</span>
            <select className="w-full rounded-xl border bg-white/70 px-3 py-2" value={payment_mode} onChange={(e) => setPM(e.target.value as never)}>
              <option value="cash">Cash</option>
              <option value="gpay">GPay</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="__other">+ Others (custom)</option>
            </select>
            {payment_mode === "__other" && (
              <input
                type="text"
                placeholder="Enter custom payment mode (saved to notes)"
                className="mt-2 w-full rounded-xl border bg-white/70 px-3 py-2"
                value={pmOther}
                onChange={(e) => setPmOther(e.target.value)}
              />
            )}
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">{mode === "income" ? "Notes" : "Description"}</span>
            <textarea className="w-full rounded-xl border bg-white/70 px-3 py-2" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Attachment {isEdit ? "(upload to replace)" : "(optional)"}</span>
            <input type="file" accept="image/*,.pdf" className="w-full text-sm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border bg-white/70 px-4 py-2 text-sm font-semibold">Cancel</button>
          <button onClick={() => save.mutate()} disabled={save.isPending} className="inline-flex items-center gap-1.5 rounded-xl gradient-sky px-4 py-2 text-sm font-semibold text-white shadow-md disabled:opacity-50">
            <Plus className="h-4 w-4" /> {save.isPending ? "Saving…" : isEdit ? "Update" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

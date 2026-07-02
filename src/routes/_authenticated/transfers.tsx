import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { BankBadge } from "@/components/BankBadge";
import { fetchAccounts, fetchTransfers } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { inr, fmtDate, todayISO } from "@/lib/format";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeftRight, Plus } from "lucide-react";

import { RequireRole } from "@/components/RequireRole";
import { ADMIN_ROLES } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/transfers")({
  head: () => ({ meta: [{ title: "Transfers — CSC Computer Education" }] }),
  component: () => <RequireRole roles={ADMIN_ROLES}><TransfersPage /></RequireRole>,
});

function TransfersPage() {
  const { user, hasAnyRole } = useAuth();
  const canEdit = hasAnyRole(["super_admin", "accountant"]);
  const qc = useQueryClient();
  const accounts = useQuery({ queryKey: ["accounts"], queryFn: fetchAccounts });
  const transfers = useQuery({ queryKey: ["transfers"], queryFn: () => fetchTransfers(200) });
  const accountMap = new Map((accounts.data ?? []).map((a) => [a.id, a] as const));

  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [amt, setAmt] = useState("");
  const [note, setNote] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const a = Number(amt);
      if (!a || a <= 0) throw new Error("Amount required");
      if (!from || !to || from === to) throw new Error("Pick two different accounts");
      const { error } = await supabase.from("account_transfers").insert({
        txn_date: date, from_account_id: from, to_account_id: to, amount: a,
        notes: note || null, created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Transfer recorded");
      qc.invalidateQueries({ queryKey: ["transfers"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      setOpen(false); setAmt(""); setNote("");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <AppShell
      title="Transfers"
      action={
        canEdit && (
          <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl gradient-sky px-3 py-2 text-sm font-semibold text-white shadow-md">
            <Plus className="h-4 w-4" /> New Transfer
          </button>
        )
      }
    >
      <div className="glass overflow-hidden rounded-2xl">
        <div className="divide-y divide-border/50">
          {(transfers.data ?? []).map((t) => {
            const f = accountMap.get(t.from_account_id);
            const tt = accountMap.get(t.to_account_id);
            return (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                {f && <BankBadge bank={f.bank as never} color={f.color} size={36} />}
                <ArrowLeftRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                {tt && <BankBadge bank={tt.bank as never} color={tt.color} size={36} />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{f?.name} → {tt?.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{fmtDate(t.txn_date)} {t.notes ? `· ${t.notes}` : ""}</p>
                </div>
                <p className="shrink-0 text-sm font-bold text-primary">{inr(t.amount)}</p>
              </div>
            );
          })}
          {!transfers.data?.length && <p className="py-12 text-center text-sm text-muted-foreground">No transfers recorded.</p>}
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4 backdrop-blur-sm">
          <div className="glass w-full max-w-md rounded-2xl p-6">
            <h2 className="text-lg font-bold">New Transfer</h2>
            <div className="mt-4 grid gap-3">
              <input type="date" className="w-full rounded-xl border bg-white/70 px-3 py-2 text-sm" value={date} onChange={(e) => setDate(e.target.value)} />
              <select className="w-full rounded-xl border bg-white/70 px-3 py-2 text-sm" value={from} onChange={(e) => setFrom(e.target.value)}>
                <option value="">From account…</option>
                {(accounts.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.name} ({inr(a.current_balance)})</option>)}
              </select>
              <select className="w-full rounded-xl border bg-white/70 px-3 py-2 text-sm" value={to} onChange={(e) => setTo(e.target.value)}>
                <option value="">To account…</option>
                {(accounts.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <input type="number" min="0.01" step="0.01" placeholder="Amount" className="w-full rounded-xl border bg-white/70 px-3 py-2 text-sm" value={amt} onChange={(e) => setAmt(e.target.value)} />
              <textarea placeholder="Notes (optional)" rows={2} className="w-full rounded-xl border bg-white/70 px-3 py-2 text-sm" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="rounded-xl border bg-white/70 px-4 py-2 text-sm font-semibold">Cancel</button>
              <button onClick={() => save.mutate()} disabled={save.isPending} className="rounded-xl gradient-sky px-4 py-2 text-sm font-semibold text-white shadow-md disabled:opacity-50">
                {save.isPending ? "Saving…" : "Transfer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { fetchAccounts, fetchReceivables } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { inr, fmtDate, todayISO } from "@/lib/format";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, HandCoins } from "lucide-react";

const TYPES = [
  { v: "cash_received", l: "Cash Received" },
  { v: "cash_returned", l: "Cash Returned" },
  { v: "gpay_received", l: "GPay Received" },
  { v: "gpay_returned", l: "GPay Returned" },
  { v: "transfer_received", l: "Transfer Received" },
  { v: "transfer_returned", l: "Transfer Returned" },
] as const;

import { RequireRole } from "@/components/RequireRole";
import { ADMIN_ROLES } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/receivables")({
  head: () => ({ meta: [{ title: "Receivables — CSC Computer Education" }] }),
  component: () => <RequireRole roles={ADMIN_ROLES}><ReceivablesPage /></RequireRole>,
});

function ReceivablesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const accounts = useQuery({ queryKey: ["accounts"], queryFn: fetchAccounts });
  const list = useQuery({ queryKey: ["receivables"], queryFn: fetchReceivables });

  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [type, setType] = useState<(typeof TYPES)[number]["v"]>("cash_received");
  const [party, setParty] = useState("");
  const [amount, setAmount] = useState("");
  const [account_id, setAccount] = useState("");
  const [notes, setNotes] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const a = Number(amount);
      if (!a || a < 0) throw new Error("Amount required");
      const { error } = await supabase.from("cash_receivables").insert({
        txn_date: date, type, party_name: party, amount: a,
        account_id: account_id || null, notes: notes || null, created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["receivables"] });
      setOpen(false); setParty(""); setAmount(""); setNotes("");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const settle = useMutation({
    mutationFn: async ({ id, amt, total }: { id: string; amt: number; total: number }) => {
      const next = amt;
      const status = next >= total ? "settled" : next > 0 ? "partial" : "pending";
      const { error } = await supabase.from("cash_receivables").update({ settled_amount: next, status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Settlement updated");
      qc.invalidateQueries({ queryKey: ["receivables"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const pendingTotal = (list.data ?? []).reduce((a, r) => a + (Number(r.amount) - Number(r.settled_amount)), 0);

  return (
    <AppShell
      title="Cash Received & Returns"
      action={
        <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl gradient-sky px-3 py-2 text-sm font-semibold text-white shadow-md">
          <Plus className="h-4 w-4" /> New Entry
        </button>
      }
    >
      <div className="glass mb-4 flex items-center gap-3 rounded-2xl p-4">
        <div className="grid h-10 w-10 place-items-center rounded-xl gradient-sky text-white"><HandCoins className="h-5 w-5" /></div>
        <div>
          <p className="text-xs text-muted-foreground">Total Outstanding</p>
          <p className="text-xl font-bold">{inr(pendingTotal)}</p>
        </div>
      </div>

      <div className="glass overflow-hidden rounded-2xl">
        <div className="divide-y divide-border/50">
          {(list.data ?? []).map((r) => {
            const pending = Number(r.amount) - Number(r.settled_amount);
            return (
              <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{r.party_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {fmtDate(r.txn_date)} · {TYPES.find((t) => t.v === r.type)?.l ?? r.type}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">{inr(r.amount)}</p>
                  <p className={`text-[11px] font-semibold uppercase ${r.status === "settled" ? "text-emerald-600" : r.status === "partial" ? "text-amber-600" : "text-rose-600"}`}>
                    {r.status} · {inr(pending)} pending
                  </p>
                </div>
                <button
                  onClick={() => {
                    const v = prompt(`Settled so far (max ${r.amount})`, String(r.settled_amount));
                    if (v == null) return;
                    settle.mutate({ id: r.id, amt: Number(v), total: Number(r.amount) });
                  }}
                  className="rounded-lg border bg-white/70 px-3 py-1.5 text-xs font-semibold"
                >Settle</button>
              </div>
            );
          })}
          {!list.data?.length && <p className="py-12 text-center text-sm text-muted-foreground">No receivables yet.</p>}
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4 backdrop-blur-sm">
          <div className="glass w-full max-w-md rounded-2xl p-6">
            <h2 className="text-lg font-bold">New Receivable / Return</h2>
            <div className="mt-4 grid gap-3">
              <input type="date" className="w-full rounded-xl border bg-white/70 px-3 py-2 text-sm" value={date} onChange={(e) => setDate(e.target.value)} />
              <select className="w-full rounded-xl border bg-white/70 px-3 py-2 text-sm" value={type} onChange={(e) => setType(e.target.value as never)}>
                {TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
              <input className="w-full rounded-xl border bg-white/70 px-3 py-2 text-sm" placeholder="Party name" value={party} onChange={(e) => setParty(e.target.value)} />
              <input type="number" min="0" step="0.01" placeholder="Amount" className="w-full rounded-xl border bg-white/70 px-3 py-2 text-sm" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <select className="w-full rounded-xl border bg-white/70 px-3 py-2 text-sm" value={account_id} onChange={(e) => setAccount(e.target.value)}>
                <option value="">Linked account (optional)</option>
                {(accounts.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <textarea rows={2} placeholder="Notes" className="w-full rounded-xl border bg-white/70 px-3 py-2 text-sm" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="rounded-xl border bg-white/70 px-4 py-2 text-sm font-semibold">Cancel</button>
              <button onClick={() => save.mutate()} disabled={!party || save.isPending} className="rounded-xl gradient-sky px-4 py-2 text-sm font-semibold text-white shadow-md disabled:opacity-50">
                {save.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

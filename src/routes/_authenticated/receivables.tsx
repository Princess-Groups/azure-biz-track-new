import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { fetchAccounts, fetchReceivables } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { inr, fmtDate, todayISO } from "@/lib/format";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, HandCoins, X } from "lucide-react";

const TYPES = [
  { v: "cash_received", l: "Cash Received" },
  { v: "cash_returned", l: "Cash Returned" },
  { v: "gpay_received", l: "GPay Received" },
  { v: "gpay_returned", l: "GPay Returned" },
  { v: "transfer_received", l: "Transfer Received" },
  { v: "transfer_returned", l: "Transfer Returned" },
  { v: "cheque_received", l: "Cheque Received" },
  { v: "cheque_returned", l: "Cheque Returned" },
] as const;

type RType = (typeof TYPES)[number]["v"];

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
  const [type, setType] = useState<RType>("cash_received");
  const [party, setParty] = useState("");
  const [amount, setAmount] = useState("");
  const [account_id, setAccount] = useState("");
  const [notes, setNotes] = useState("");
  const [chequeNo, setChequeNo] = useState("");
  const [chequeBank, setChequeBank] = useState("");
  const [chequeDate, setChequeDate] = useState("");

  const [settleFor, setSettleFor] = useState<{ id: string; amount: number; settled: number; account_id: string | null } | null>(null);
  const [settleAmt, setSettleAmt] = useState("");
  const [settleAcc, setSettleAcc] = useState("");

  const isCheque = type === "cheque_received" || type === "cheque_returned";

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const a = Number(amount);
      if (!a || a < 0) throw new Error("Amount required");
      if (isCheque && !chequeNo.trim()) throw new Error("Cheque number required");
      const payload: Record<string, unknown> = {
        txn_date: date, type, party_name: party, amount: a,
        account_id: account_id || null, notes: notes || null, created_by: user.id,
      };
      if (isCheque) {
        payload.cheque_no = chequeNo.trim() || null;
        payload.cheque_bank = chequeBank.trim() || null;
        payload.cheque_date = chequeDate || null;
      }
      const { error } = await (supabase.from("cash_receivables") as unknown as { insert: (v: Record<string, unknown>) => Promise<{ error: unknown }> }).insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["receivables"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      setOpen(false); setParty(""); setAmount(""); setNotes("");
      setChequeNo(""); setChequeBank(""); setChequeDate("");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const settle = useMutation({
    mutationFn: async ({ id, amt, total, accId }: { id: string; amt: number; total: number; accId: string }) => {
      if (!accId) throw new Error("Please select a settlement account");
      if (amt < 0 || amt > total) throw new Error(`Settled amount must be between 0 and ${total}`);
      const status = amt >= total ? "settled" : amt > 0 ? "partial" : "pending";
      const { error } = await supabase
        .from("cash_receivables")
        .update({ settled_amount: amt, status, account_id: accId })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Settlement updated — account balance synced");
      qc.invalidateQueries({ queryKey: ["receivables"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      setSettleFor(null);
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
            const rec = r as typeof r & { cheque_no?: string | null; cheque_bank?: string | null; cheque_date?: string | null };
            return (
              <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{r.party_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {fmtDate(r.txn_date)} · {TYPES.find((t) => t.v === r.type)?.l ?? r.type}
                    {rec.cheque_no ? ` · Cheque #${rec.cheque_no}${rec.cheque_bank ? ` (${rec.cheque_bank})` : ""}${rec.cheque_date ? ` · ${fmtDate(rec.cheque_date)}` : ""}` : ""}
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
                    setSettleFor({ id: r.id, amount: Number(r.amount), settled: Number(r.settled_amount), account_id: r.account_id });
                    setSettleAmt(String(r.settled_amount));
                    setSettleAcc(r.account_id ?? "");
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
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/30 p-4 backdrop-blur-sm flex items-start justify-center">
          <div className="glass w-full max-w-md rounded-2xl p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">New Receivable / Return</h2>
              <button onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/60"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-3">
              <input type="date" className="w-full rounded-xl border bg-white/70 px-3 py-2 text-sm" value={date} onChange={(e) => setDate(e.target.value)} />
              <select className="w-full rounded-xl border bg-white/70 px-3 py-2 text-sm" value={type} onChange={(e) => setType(e.target.value as RType)}>
                {TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
              <input className="w-full rounded-xl border bg-white/70 px-3 py-2 text-sm" placeholder="Party name" value={party} onChange={(e) => setParty(e.target.value)} />
              <input type="number" min="0" step="0.01" placeholder="Amount" className="w-full rounded-xl border bg-white/70 px-3 py-2 text-sm" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <select className="w-full rounded-xl border bg-white/70 px-3 py-2 text-sm" value={account_id} onChange={(e) => setAccount(e.target.value)}>
                <option value="">Linked account (optional — required to sync balance on settlement)</option>
                {(accounts.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              {isCheque && (
                <div className="grid gap-3 rounded-xl border border-dashed bg-white/40 p-3">
                  <p className="text-xs font-semibold text-muted-foreground">Cheque Details</p>
                  <input className="w-full rounded-xl border bg-white/70 px-3 py-2 text-sm" placeholder="Cheque No" value={chequeNo} onChange={(e) => setChequeNo(e.target.value)} />
                  <input className="w-full rounded-xl border bg-white/70 px-3 py-2 text-sm" placeholder="Cheque Received Bank" value={chequeBank} onChange={(e) => setChequeBank(e.target.value)} />
                  <label className="text-xs">
                    <span className="mb-1 block text-muted-foreground">Cheque Date</span>
                    <input type="date" className="w-full rounded-xl border bg-white/70 px-3 py-2 text-sm" value={chequeDate} onChange={(e) => setChequeDate(e.target.value)} />
                  </label>
                </div>
              )}
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

      {settleFor && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/30 p-4 backdrop-blur-sm flex items-start justify-center">
          <div className="glass w-full max-w-md rounded-2xl p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Settle Receivable</h2>
              <button onClick={() => setSettleFor(null)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/60"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid gap-3">
              <p className="text-xs text-muted-foreground">
                Total: <span className="font-semibold text-foreground">{inr(settleFor.amount)}</span> · Currently settled: {inr(settleFor.settled)}
              </p>
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Settlement Account <span className="text-rose-500">*</span></span>
                <select className="w-full rounded-xl border bg-white/70 px-3 py-2 text-sm" value={settleAcc} onChange={(e) => setSettleAcc(e.target.value)}>
                  <option value="">— select account (Cash in Hand / Bank) —</option>
                  {(accounts.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Settled Amount (max {inr(settleFor.amount)})</span>
                <input
                  type="number" min="0" step="0.01" max={settleFor.amount}
                  className="w-full rounded-xl border bg-white/70 px-3 py-2 text-sm"
                  value={settleAmt}
                  onChange={(e) => setSettleAmt(e.target.value)}
                />
              </label>
              <div className="flex gap-2">
                <button onClick={() => setSettleAmt(String(settleFor.amount))} className="rounded-lg border bg-white/70 px-3 py-1.5 text-xs font-semibold">Full Settlement</button>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setSettleFor(null)} className="rounded-xl border bg-white/70 px-4 py-2 text-sm font-semibold">Cancel</button>
              <button
                onClick={() => settle.mutate({ id: settleFor.id, amt: Number(settleAmt), total: settleFor.amount, accId: settleAcc })}
                disabled={settle.isPending || !settleAcc}
                className="rounded-xl gradient-sky px-4 py-2 text-sm font-semibold text-white shadow-md disabled:opacity-50"
              >
                {settle.isPending ? "Saving…" : "Save Settlement"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

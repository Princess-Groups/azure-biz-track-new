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
import { ArrowLeftRight, Plus, Settings2, X, Pencil, Trash2 } from "lucide-react";

import { RequireRole } from "@/components/RequireRole";
import { ADMIN_ROLES } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/transfers")({
  head: () => ({ meta: [{ title: "Transfers — CSC Computer Education" }] }),
  component: () => <RequireRole roles={ADMIN_ROLES}><TransfersPage /></RequireRole>,
});

type Collection = { id: string; name: string; account_id: string | null };

async function fetchCollections(): Promise<Collection[]> {
  const { data, error } = await supabase
    .from("collection_accounts" as never)
    .select("id,name,account_id")
    .order("name");
  if (error) throw error;
  return (data as unknown as Collection[]) ?? [];
}

function TransfersPage() {
  const { user, hasAnyRole } = useAuth();
  const canEdit = hasAnyRole(["super_admin", "accountant"]);
  const qc = useQueryClient();
  const accounts = useQuery({ queryKey: ["accounts"], queryFn: fetchAccounts });
  const transfers = useQuery({ queryKey: ["transfers"], queryFn: () => fetchTransfers(200) });
  const collections = useQuery({ queryKey: ["collections"], queryFn: fetchCollections });
  const accountMap = new Map((accounts.data ?? []).map((a) => [a.id, a] as const));

  const [open, setOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [date, setDate] = useState(todayISO());
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [amt, setAmt] = useState("");
  const [note, setNote] = useState("");

  const resetForm = () => {
    setEditingId(null); setDate(todayISO()); setFrom(""); setTo("");
    setCollectionId(""); setAmt(""); setNote("");
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const a = Number(amt);
      if (!a || a <= 0) throw new Error("Amount required");
      if (!from || !to || from === to) throw new Error("Pick two different accounts");
      const collectionName = collections.data?.find((c) => c.id === collectionId)?.name;
      const finalNote = collectionName
        ? note
          ? `${collectionName} · ${note}`
          : collectionName
        : note || null;
      if (editingId) {
        const { error } = await supabase.from("account_transfers").update({
          txn_date: date, from_account_id: from, to_account_id: to, amount: a, notes: finalNote,
        }).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("account_transfers").insert({
          txn_date: date, from_account_id: from, to_account_id: to, amount: a,
          notes: finalNote, created_by: user.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Transfer updated" : "Transfer recorded");
      qc.invalidateQueries({ queryKey: ["transfers"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      setOpen(false); resetForm();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("account_transfers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Transfer deleted");
      qc.invalidateQueries({ queryKey: ["transfers"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const openEdit = (t: { id: string; txn_date: string; from_account_id: string; to_account_id: string; amount: number; notes: string | null }) => {
    setEditingId(t.id);
    setDate(t.txn_date);
    setFrom(t.from_account_id);
    setTo(t.to_account_id);
    setAmt(String(t.amount));
    setNote(t.notes ?? "");
    setCollectionId("");
    setOpen(true);
  };

  const handleCollectionPick = (id: string) => {
    setCollectionId(id);
    const c = collections.data?.find((x) => x.id === id);
    if (c?.account_id) setTo(c.account_id);
  };

  const mapCollection = useMutation({
    mutationFn: async ({ id, account_id }: { id: string; account_id: string | null }) => {
      const { error } = await (supabase as unknown as {
        from: (t: string) => {
          update: (v: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<{ error: unknown }> };
        };
      })
        .from("collection_accounts")
        .update({ account_id })
        .eq("id", id);
      if (error) throw error as Error;
    },
    onSuccess: () => {
      toast.success("Collection updated");
      qc.invalidateQueries({ queryKey: ["collections"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <AppShell
      title="Transfers"
      action={
        canEdit && (
          <div className="flex gap-2">
            <button onClick={() => setManageOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl border bg-white/70 px-3 py-2 text-sm font-semibold">
              <Settings2 className="h-4 w-4" /> Collections
            </button>
            <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl gradient-sky px-3 py-2 text-sm font-semibold text-white shadow-md">
              <Plus className="h-4 w-4" /> New Transfer
            </button>
          </div>
        )
      }
    >
      {/* Collections summary */}
      {(collections.data?.length ?? 0) > 0 && (
        <div className="glass mb-4 rounded-2xl p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Collection Accounts</p>
            <p className="text-[10px] text-muted-foreground">Pick a collection in New Transfer to auto-select its mapped bank</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {(collections.data ?? []).map((c) => {
              const acc = c.account_id ? accountMap.get(c.account_id) : undefined;
              return (
                <div key={c.id} className="flex items-center gap-2 rounded-xl border bg-white/70 p-3">
                  {acc ? <BankBadge bank={acc.bank as never} color={acc.color} size={32} /> : <div className="grid h-8 w-8 place-items-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">—</div>}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{acc ? acc.name : "No bank mapped"}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
                {canEdit && (
                  <>
                    <button onClick={() => openEdit(t)} className="grid h-8 w-8 place-items-center rounded-lg text-primary hover:bg-primary/10" title="Edit">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => confirm("Delete this transfer? This cannot be undone.") && del.mutate(t.id)} className="grid h-8 w-8 place-items-center rounded-lg text-rose-500 hover:bg-rose-50" title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            );
          })}
          {!transfers.data?.length && <p className="py-12 text-center text-sm text-muted-foreground">No transfers recorded.</p>}
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4 backdrop-blur-sm">
          <div className="glass w-full max-w-md rounded-2xl p-6">
            <h2 className="text-lg font-bold">{editingId ? "Edit Transfer" : "New Transfer"}</h2>
            <div className="mt-4 grid gap-3">
              <input type="date" className="w-full rounded-xl border bg-white/70 px-3 py-2 text-sm" value={date} onChange={(e) => setDate(e.target.value)} />
              <select className="w-full rounded-xl border bg-white/70 px-3 py-2 text-sm" value={from} onChange={(e) => setFrom(e.target.value)}>
                <option value="">From account…</option>
                {(accounts.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.name} ({inr(a.current_balance)})</option>)}
              </select>
              <label className="text-xs font-semibold text-muted-foreground">
                Collection (optional — auto-fills the destination bank)
                <select className="mt-1 w-full rounded-xl border bg-white/70 px-3 py-2 text-sm font-normal text-foreground" value={collectionId} onChange={(e) => handleCollectionPick(e.target.value)}>
                  <option value="">— none —</option>
                  {(collections.data ?? []).map((c) => {
                    const acc = c.account_id ? accountMap.get(c.account_id) : undefined;
                    return (
                      <option key={c.id} value={c.id}>
                        {c.name}{acc ? ` → ${acc.name}` : " (no bank mapped)"}
                      </option>
                    );
                  })}
                </select>
              </label>
              <select className="w-full rounded-xl border bg-white/70 px-3 py-2 text-sm" value={to} onChange={(e) => setTo(e.target.value)}>
                <option value="">To account…</option>
                {(accounts.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <input type="number" min="0.01" step="0.01" placeholder="Amount" className="w-full rounded-xl border bg-white/70 px-3 py-2 text-sm" value={amt} onChange={(e) => setAmt(e.target.value)} />
              <textarea placeholder="Notes (optional)" rows={2} className="w-full rounded-xl border bg-white/70 px-3 py-2 text-sm" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => { setOpen(false); resetForm(); }} className="rounded-xl border bg-white/70 px-4 py-2 text-sm font-semibold">Cancel</button>
              <button onClick={() => save.mutate()} disabled={save.isPending} className="rounded-xl gradient-sky px-4 py-2 text-sm font-semibold text-white shadow-md disabled:opacity-50">
                {save.isPending ? "Saving…" : editingId ? "Update" : "Transfer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {manageOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4 backdrop-blur-sm">
          <div className="glass w-full max-w-lg rounded-2xl p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Manage</p>
                <h2 className="text-lg font-bold">Collection → Bank Mapping</h2>
              </div>
              <button onClick={() => setManageOpen(false)} className="rounded-lg p-1 hover:bg-white/60"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-4 space-y-2">
              {(collections.data ?? []).map((c) => (
                <div key={c.id} className="flex items-center gap-3 rounded-xl border bg-white/70 p-3">
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold">{c.name}</p>
                  <select
                    className="rounded-lg border bg-white px-2 py-1.5 text-sm"
                    value={c.account_id ?? ""}
                    onChange={(e) => mapCollection.mutate({ id: c.id, account_id: e.target.value || null })}
                  >
                    <option value="">— unmapped —</option>
                    {(accounts.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              ))}
              {!collections.data?.length && <p className="py-6 text-center text-sm text-muted-foreground">No collections yet.</p>}
            </div>
            <div className="mt-5 flex justify-end">
              <button onClick={() => setManageOpen(false)} className="rounded-xl gradient-sky px-4 py-2 text-sm font-semibold text-white shadow-md">Done</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

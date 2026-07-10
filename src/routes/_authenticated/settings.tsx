import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { toast } from "sonner";
import { Shield, UserPlus } from "lucide-react";
import { createSuperAdmin } from "@/lib/admin-users.functions";

import { RequireRole } from "@/components/RequireRole";
import { ADMIN_ROLES } from "@/lib/permissions";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — CSC Computer Education" }] }),
  component: () => <RequireRole roles={ADMIN_ROLES}><SettingsPage /></RequireRole>,
});

const ROLES = ["super_admin", "accountant", "branch_manager", "staff", "viewer"] as const;

function SettingsPage() {
  const { user, roles, hasRole } = useAuth();
  const isAdmin = hasRole("super_admin");
  const qc = useQueryClient();

  const profiles = useQuery({
    queryKey: ["all-profiles"],
    enabled: isAdmin,
    queryFn: async () => {
      const [{ data: ps, error: pErr }, { data: rs, error: rErr }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (pErr) throw pErr;
      if (rErr) throw rErr;
      const roleMap = new Map<string, string[]>();
      for (const r of rs ?? []) {
        const arr = roleMap.get(r.user_id) ?? [];
        arr.push(r.role as string);
        roleMap.set(r.user_id, arr);
      }
      return (ps ?? []).map((p) => ({ ...p, roles: roleMap.get(p.id) ?? [] }));
    },
  });

  const setRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: (typeof ROLES)[number] }) => {
      const { error: dErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
      if (dErr) throw dErr;
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["all-profiles"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <AppShell title="Settings">
      <div className="glass rounded-2xl p-6">
        <h2 className="text-lg font-bold">Your profile</h2>
        <dl className="mt-3 grid grid-cols-[120px_1fr] gap-y-2 text-sm">
          <dt className="text-muted-foreground">Email</dt><dd className="font-medium">{user?.email}</dd>
          <dt className="text-muted-foreground">Roles</dt><dd className="font-medium">{roles.join(", ") || "—"}</dd>
        </dl>
      </div>

      {isAdmin && <CreateSuperAdminCard onCreated={() => qc.invalidateQueries({ queryKey: ["all-profiles"] })} />}

      {isAdmin && (
        <div className="glass mt-6 rounded-2xl p-6">
          <div className="mb-3 flex items-center gap-2"><Shield className="h-5 w-5 text-primary" /><h2 className="text-lg font-bold">User management</h2></div>
          <div className="divide-y divide-border/50">
            {(profiles.data ?? []).map((p) => {
              const current = p.roles[0] ?? "viewer";
              return (
                <div key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{p.full_name ?? "—"}</p>
                    <p className="truncate text-xs text-muted-foreground">{p.email}</p>
                  </div>
                  <select
                    defaultValue={current}
                    onChange={(e) => setRole.mutate({ userId: p.id, role: e.target.value as (typeof ROLES)[number] })}
                    className="rounded-xl border bg-white/70 px-3 py-1.5 text-sm"
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="glass mt-6 rounded-2xl p-6">
        <h2 className="text-lg font-bold">Future modules</h2>
        <p className="mt-1 text-sm text-muted-foreground">Database tables are ready for these features and can be activated later.</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {["GST Tracking","Salary Management","Employee Payroll","Inventory Management","Purchase Order Approval","Loan Management","Jewelry Revenue","Branch Franchise","Multi-Company","WhatsApp Sharing","Bank API Integration","Excel Auto Import"].map((m) => (
            <li key={m} className="rounded-xl bg-white/40 px-3 py-2 text-sm">{m}</li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}

function CreateSuperAdminCard({ onCreated }: { onCreated: () => void }) {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"super_admin" | "staff">("staff");
  const fn = useServerFn(createSuperAdmin);
  const create = useMutation({
    mutationFn: async () =>
      fn({ data: { userId, password, fullName: fullName || undefined, role } }),
    onSuccess: () => {
      toast.success(`${role === "super_admin" ? "Super Admin" : "Staff"} "${userId}" created`);
      setUserId(""); setPassword(""); setFullName("");
      onCreated();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="glass mt-6 rounded-2xl p-6">
      <div className="mb-3 flex items-center gap-2">
        <UserPlus className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">Create new user</h2>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Staff users can enter income & business expenses and view reports. Super Admins have full access including Personal Expenses, Accounts and Settings.
      </p>
      <div className="mb-3 flex gap-2">
        {(["staff", "super_admin"] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRole(r)}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
              role === r ? "gradient-sky text-white shadow-md" : "bg-white/70 text-muted-foreground"
            }`}
          >
            {r === "super_admin" ? "Super Admin" : "Staff"}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <input
          className="rounded-xl border bg-white/70 px-3 py-2 text-sm"
          placeholder="User ID"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        />
        <input
          className="rounded-xl border bg-white/70 px-3 py-2 text-sm"
          placeholder="Full name (optional)"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
        <input
          className="rounded-xl border bg-white/70 px-3 py-2 text-sm"
          type="password"
          placeholder="Password (min 6)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="mt-4 flex justify-end">
        <button
          onClick={() => create.mutate()}
          disabled={create.isPending || userId.length < 3 || password.length < 6}
          className="inline-flex items-center gap-1.5 rounded-xl gradient-sky px-4 py-2 text-sm font-semibold text-white shadow-md disabled:opacity-50"
        >
          <UserPlus className="h-4 w-4" />
          {create.isPending ? "Creating…" : `Create ${role === "super_admin" ? "Super Admin" : "Staff"}`}
        </button>
      </div>
    </div>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { User, Lock } from "lucide-react";
import cscLogo from "@/assets/csc-logo.png";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — CSC Computer Education" },
      { name: "description", content: "Sign in to CSC Computer Education financial dashboard." },
    ],
  }),
  component: AuthPage,
});

function userIdToEmail(userId: string): string {
  const clean = userId.trim().toLowerCase();
  if (clean.includes("@")) return clean;
  return `${clean}@csc.local`;
}

function AuthPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/", replace: true });
  }, [loading, session, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const email = userIdToEmail(userId);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Welcome back!");
    } catch (err) {
      toast.error("Invalid User ID or password");
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass w-full max-w-md rounded-3xl p-8">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-2xl shadow-md">
            <img src={cscLogo} alt="CSC" className="h-full w-full object-cover" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gradient-sky">CSC Computer Education</h1>
            <p className="text-xs text-muted-foreground">Financial Accounts Dashboard</p>
          </div>
        </div>

        <h2 className="mb-5 text-xl font-bold text-foreground">Sign In</h2>

        <form onSubmit={submit} className="space-y-3">
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              required
              type="text"
              autoComplete="username"
              placeholder="User ID"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full rounded-xl border bg-white/70 px-4 py-2.5 pl-10 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              required
              type="password"
              autoComplete="current-password"
              minLength={6}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border bg-white/70 px-4 py-2.5 pl-10 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="mt-2 w-full rounded-xl gradient-sky px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Please wait…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

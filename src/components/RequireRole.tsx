import { Navigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAuth, type AppRole } from "@/hooks/useAuth";

/** Renders children only if user has any of the allowed roles. Otherwise redirects to `/`. */
export function RequireRole({
  roles: allowed,
  children,
}: {
  roles: AppRole[];
  children: ReactNode;
}) {
  const { roles, loading } = useAuth();
  if (loading) return null;
  const ok = roles.some((r) => allowed.includes(r));
  if (!ok) return <Navigate to="/" replace />;
  return <>{children}</>;
}

import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Wallet, TrendingUp, TrendingDown, ArrowLeftRight, HandCoins,
  ListChecks, CalendarDays, CalendarRange, CalendarCheck, Settings, LogOut, UserCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { canSeeAccounts, canSeePersonal, isAdmin } from "@/lib/permissions";
import cscLogo from "@/assets/csc-logo.png";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, roles, signOut } = useAuth();

  const admin = isAdmin(roles);
  const seeAccounts = canSeeAccounts(roles);
  const seePersonal = canSeePersonal(roles);

  const NAV: { group: string; items: NavItem[] }[] = admin
    ? [
        {
          group: "Overview",
          items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true }],
        },
        {
          group: "Money",
          items: [
            ...(seeAccounts ? [{ to: "/accounts", label: "Accounts", icon: Wallet }] : []),
            { to: "/income", label: "Income", icon: TrendingUp },
            { to: "/expenses", label: "Business Expenses", icon: TrendingDown },
            ...(seePersonal
              ? [{ to: "/personal-expenses", label: "Personal Expenses", icon: UserCircle }]
              : []),
            { to: "/transfers", label: "Transfers", icon: ArrowLeftRight },
            { to: "/receivables", label: "Receivables", icon: HandCoins },
            { to: "/transactions", label: "All Transactions", icon: ListChecks },
          ],
        },
        {
          group: "Reports",
          items: [
            { to: "/reports/daily", label: "Daily", icon: CalendarDays },
            { to: "/reports/monthly", label: "Monthly", icon: CalendarRange },
            { to: "/reports/yearly", label: "Yearly", icon: CalendarCheck },
          ],
        },
        { group: "System", items: [{ to: "/settings", label: "Settings", icon: Settings }] },
      ]
    : [
        {
          group: "Entry",
          items: [
            { to: "/income", label: "Income Entry", icon: TrendingUp },
            { to: "/expenses", label: "Expense Entry", icon: TrendingDown },
          ],
        },
      ];

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  return (
    <aside className="glass flex h-full w-64 shrink-0 flex-col gap-1 rounded-none border-r p-3 lg:rounded-r-2xl">
      <div className="flex items-center gap-3 px-2 py-3">
        <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-xl shadow-md">
          <img src={cscLogo} alt="CSC Computer Education" className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold leading-tight text-gradient-sky">CSC Computer Education</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {admin ? "Admin Portal" : "Staff Portal"}
          </p>
        </div>
      </div>

      <div className="mt-1 flex-1 space-y-4 overflow-y-auto px-1">
        {NAV.map((g) => (
          <div key={g.group}>
            <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{g.group}</p>
            <div className="space-y-0.5">
              {g.items.map((it) => {
                const active = isActive(it.to, it.exact);
                return (
                  <Link
                    key={it.to}
                    to={it.to}
                    onClick={onNavigate}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all",
                      active
                        ? "gradient-sky text-white shadow-md"
                        : "text-foreground/80 hover:bg-white/60 hover:text-foreground",
                    )}
                  >
                    <it.icon className={cn("h-4 w-4 shrink-0", active ? "text-white" : "text-primary")} />
                    <span className="truncate">{it.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="glass-soft mt-2 rounded-xl p-3">
        <p className="truncate text-xs font-medium text-foreground">{user?.email}</p>
        <p className="mt-0.5 truncate text-[10px] uppercase tracking-wider text-muted-foreground">
          {roles[0]?.replace("_", " ") ?? "no role"}
        </p>
        <button
          onClick={() => signOut()}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-white/70 px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-white"
        >
          <LogOut className="h-3.5 w-3.5" /> Sign out
        </button>
      </div>
    </aside>
  );
}

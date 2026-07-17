import { useState, type ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { Menu } from "lucide-react";

export function AppShell({ children, title, action }: { children: ReactNode; title?: string; action?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen w-full">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <AppSidebar />
      </div>

      {/* Mobile sidebar */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64">
            <AppSidebar onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="glass sticky top-0 z-30 flex items-center justify-between gap-3 border-b px-4 py-3 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              className="grid h-9 w-9 place-items-center rounded-lg bg-white/70 lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="truncate text-lg font-bold text-foreground sm:text-xl">{title}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {action}
          </div>
        </header>

        <div className="flex-1 px-4 py-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}

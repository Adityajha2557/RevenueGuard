import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  BadgeCheck,
  LayoutDashboard,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/leakage", label: "Revenue Leakage", icon: AlertTriangle },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/approvals", label: "Approvals", icon: BadgeCheck },
  { to: "/recovery", label: "Recovery History", icon: Wallet },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-md bg-primary/15 text-primary">
              <ShieldCheck className="size-4.5" />
            </span>
            <span>
              <span className="block text-sm font-semibold tracking-tight">RevenueGuard AI</span>
              <span className="block text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Leakage detection &amp; recovery
              </span>
            </span>
          </Link>

          <nav className="-mx-1 flex gap-1 overflow-x-auto pb-1 lg:pb-0">
            {NAV.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact: to === "/" }}
                className="flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground [&.active]:bg-primary/12 [&.active]:text-primary"
              >
                <Icon className="size-4" />
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}

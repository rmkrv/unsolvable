import Link from "next/link";
import {
  Bell,
  BookOpen,
  ChevronDown,
  CircleUserRound,
  Home,
  LayoutGrid,
  LogOut,
  Menu as MenuIcon,
  Settings,
  Target,
  Users,
} from "lucide-react";
import { Brand } from "@/components/brand";
import type { AuthenticatedUser } from "@/lib/server/auth/current-user";

export type AppSection = "home" | "practice" | "weak-spots" | "friends" | "boards" | "settings";

const navigation = [
  { id: "home" as const, label: "Home", href: "/home", icon: Home },
  { id: "practice" as const, label: "Practice", href: "/boards/current", icon: BookOpen },
  { id: "weak-spots" as const, label: "Weak spots", href: "/weak-spots", icon: Target },
  { id: "friends" as const, label: "Friends", href: "/friends", icon: Users },
  { id: "boards" as const, label: "Boards", href: "/boards", icon: LayoutGrid },
];

function initials(user: AuthenticatedUser) {
  const source = user.fullName || user.email;
  return source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
}

export function AppShell({
  user,
  active,
  title,
  children,
}: {
  user: AuthenticatedUser;
  active: AppSection;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="drawer min-h-screen bg-base-100 lg:drawer-open">
      <input id="app-navigation" type="checkbox" className="drawer-toggle" />

      <div className="drawer-content flex min-w-0 flex-col">
        <header className="navbar sticky top-0 z-30 min-h-16 border-b border-base-300/80 bg-base-100/90 px-4 backdrop-blur-xl sm:px-7">
          <div className="navbar-start gap-3">
            <label
              htmlFor="app-navigation"
              className="btn btn-ghost btn-circle drawer-button lg:hidden"
              aria-label="Open navigation"
            >
              <MenuIcon size={20} />
            </label>
            <div className="lg:hidden"><Brand href="/home" compact /></div>
            <div className="hidden lg:block">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-base-content/45">Workspace</p>
              <h1 className="mt-0.5 text-base font-semibold tracking-tight">{title}</h1>
            </div>
          </div>

          <div className="navbar-end gap-2">
            <button type="button" className="btn btn-ghost btn-circle" aria-label="Notifications are not available yet" title="Notifications are not available yet" disabled>
              <Bell size={18} />
            </button>
            <details className="dropdown dropdown-end">
              <summary className="btn btn-ghost h-11 list-none gap-2 px-2 sm:px-3">
                <span className="avatar avatar-placeholder">
                  <span className="flex size-8 items-center justify-center rounded-full bg-neutral text-xs font-bold text-neutral-content">
                    {initials(user)}
                  </span>
                </span>
                <span className="hidden max-w-36 truncate text-sm font-medium sm:block">{user.displayName}</span>
                <ChevronDown size={14} className="hidden text-base-content/45 sm:block" />
              </summary>
              <ul className="dropdown-content menu z-50 mt-2 w-60 rounded-box border border-base-300 bg-base-100 p-2 shadow-xl">
                <li className="menu-title px-3 py-2">
                  <span className="truncate normal-case font-normal text-base-content/55">{user.email}</span>
                </li>
                <li><Link href="/settings/profile"><Settings size={16} /> Settings</Link></li>
                <li><Link href="/auth/sign-out?redirectTo=/"><LogOut size={16} /> Sign out</Link></li>
              </ul>
            </details>
          </div>
        </header>

        <main className="min-w-0 flex-1 pb-24 lg:pb-8">{children}</main>

        <nav className="dock dock-sm z-40 border-t border-base-300 bg-base-100/95 backdrop-blur-xl lg:hidden" aria-label="Primary navigation">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.id} href={item.href} className={active === item.id ? "dock-active" : ""}>
                <Icon size={19} />
                <span className="dock-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="drawer-side z-50">
        <label htmlFor="app-navigation" aria-label="Close navigation" className="drawer-overlay" />
        <aside className="flex min-h-full w-72 flex-col border-r border-base-300 bg-base-200 px-4 py-5">
          <div className="px-2 pb-7"><Brand href="/home" /></div>

          <ul className="menu w-full gap-1 p-0">
            <li className="menu-title px-3 pb-2 text-[0.68rem] uppercase tracking-[0.16em] text-base-content/40">Learn</li>
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className={active === item.id ? "menu-active font-semibold" : "font-medium text-base-content/70"}
                  >
                    <Icon size={18} strokeWidth={1.8} />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="mt-auto space-y-4 pt-7">
            <div className="rounded-box border border-base-300 bg-base-100 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold">Learning rhythm</span>
                <span className="badge badge-success badge-soft badge-sm">On track</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-base-content/55">Two focused sessions this week. One more builds momentum.</p>
              <progress className="progress progress-success mt-3 h-1.5" value="66" max="100" />
            </div>

            <Link
              href="/settings/profile"
              className={`flex items-center gap-3 rounded-field px-3 py-2.5 text-sm font-medium ${active === "settings" ? "bg-base-300" : "hover:bg-base-300/70"}`}
            >
              <CircleUserRound size={18} />
              Account settings
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

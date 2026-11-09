import Link from "next/link";
import { LogOut, Menu, Settings } from "lucide-react";
import { Brand } from "@/components/brand";
import type { Viewer } from "@/lib/server/auth/viewer";

type ShellViewer = Pick<Viewer, "displayName" | "email" | "fullName">;
type NavigationItem = { label: string; href: string };

function RoleShell({
  viewer,
  title,
  roleLabel,
  homeHref,
  navigation,
  children,
}: {
  viewer: ShellViewer;
  title: string;
  roleLabel: string;
  homeHref: string;
  navigation: NavigationItem[];
  children: React.ReactNode;
}) {
  return (
    <div className="drawer lg:drawer-open">
      <input id="role-navigation" type="checkbox" className="drawer-toggle" />
      <div className="drawer-content min-h-screen bg-base-100">
        <header className="navbar sticky top-0 z-30 border-b border-base-300 bg-base-100/95 px-4 backdrop-blur sm:px-7">
          <div className="navbar-start gap-3">
            <label htmlFor="role-navigation" className="btn btn-ghost btn-square drawer-button lg:hidden" aria-label="Open navigation">
              <Menu size={20} />
            </label>
            <div>
              <p className="text-xs text-base-content/55">{roleLabel}</p>
              <h1 className="text-sm font-semibold">{title}</h1>
            </div>
          </div>
          <div className="navbar-end gap-3">
            <div className="hidden text-right sm:block">
              <p className="max-w-48 truncate text-sm font-medium">{viewer.fullName || viewer.displayName}</p>
              <p className="max-w-48 truncate text-xs text-base-content/50">{viewer.email}</p>
            </div>
            <Link className="btn btn-ghost btn-sm" href="/auth/sign-out?redirectTo=/">
              <LogOut size={16} /> Sign out
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:px-10">{children}</main>
      </div>
      <aside className="drawer-side z-40">
        <label htmlFor="role-navigation" aria-label="Close navigation" className="drawer-overlay" />
        <div className="flex min-h-full w-72 flex-col border-r border-base-300 bg-base-200 p-4 text-base-content">
          <div className="px-3 pb-7 pt-2"><Brand href={homeHref} /></div>
          <ul className="menu w-full gap-1">
            <li className="menu-title">{roleLabel}</li>
            {navigation.map((item) => <li key={item.href}><Link href={item.href}>{item.label}</Link></li>)}
          </ul>
          <div className="mt-auto">
            <Link className="btn btn-ghost btn-block justify-start" href={`${homeHref}#settings`}><Settings size={17} />Account settings</Link>
          </div>
        </div>
      </aside>
    </div>
  );
}

const parentNavigation = [
  { label: "Students", href: "/parent#students" },
  { label: "Attendance", href: "/parent#attendance" },
  { label: "Performance", href: "/parent#performance" },
  { label: "Planning", href: "/parent#planning" },
  { label: "Billing", href: "/parent#billing" },
];

const adminNavigation = [
  { label: "Users", href: "/admin#users" },
  { label: "Relationships", href: "/admin#relationships" },
  { label: "Billing support", href: "/admin#billing" },
  { label: "Audit", href: "/admin#audit" },
];

export function ParentShell(props: { viewer: ShellViewer; title: string; children: React.ReactNode }) {
  return <RoleShell {...props} roleLabel="Parent workspace" homeHref="/parent" navigation={parentNavigation} />;
}

export function AdminShell(props: { viewer: ShellViewer; title: string; children: React.ReactNode }) {
  return <RoleShell {...props} roleLabel="Administration" homeHref="/admin" navigation={adminNavigation} />;
}

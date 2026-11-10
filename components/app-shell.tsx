import Link from "next/link";
import {
  Bell,
  BookOpen,
  CalendarDays,
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PendingLink } from "@/components/pending-link";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { Viewer } from "@/lib/server/auth/viewer";

type ShellUser = Pick<Viewer, "displayName" | "email" | "fullName">;

export type AppSection = "home" | "practice" | "calendar" | "weak-spots" | "friends" | "boards" | "settings";

const navigation = [
  { id: "home" as const, label: "Home", href: "/home", icon: Home },
  { id: "practice" as const, label: "Practice", href: "/boards/current", icon: BookOpen },
  { id: "calendar" as const, label: "Schedule", href: "/calendar", icon: CalendarDays },
  { id: "weak-spots" as const, label: "Weak spots", href: "/weak-spots", icon: Target },
  { id: "friends" as const, label: "Friends", href: "/friends", icon: Users },
  { id: "boards" as const, label: "Boards", href: "/boards", icon: LayoutGrid },
];

function initials(user: ShellUser) {
  const source = user.fullName || user.email;
  return source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
}

export function StudentShell({
  user,
  active,
  title,
  children,
}: {
  user: ShellUser;
  active: AppSection;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-border bg-muted/45 lg:flex lg:flex-col">
        <SidebarContent active={active} />
      </aside>

      <div className="min-h-screen lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-xl sm:px-7">
          <div className="flex items-center gap-3">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation"><MenuIcon /></Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 gap-0 p-0 sm:max-w-72">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <SidebarContent active={active} />
              </SheetContent>
            </Sheet>
            <div className="lg:hidden"><Brand href="/home" compact /></div>
            <div className="hidden lg:block"><p className="text-xs font-medium text-muted-foreground">Workspace</p><h1 className="mt-0.5 text-sm font-semibold">{title}</h1></div>
          </div>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" aria-label="Notifications are not available yet" title="Notifications are not available yet" disabled><Bell /></Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild id="student-account-menu-trigger">
                <Button variant="ghost" className="h-10 gap-2 px-2 sm:px-3">
                  <Avatar><AvatarFallback className="bg-foreground text-background">{initials(user)}</AvatarFallback></Avatar>
                  <span className="hidden max-w-36 truncate sm:block">{user.displayName}</span>
                  <ChevronDown className="hidden text-muted-foreground sm:block" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60" aria-labelledby="student-account-menu-trigger">
                <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link href="/settings/profile"><Settings />Settings</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="/auth/sign-out?redirectTo=/"><LogOut />Sign out</Link></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="app-page-enter min-w-0 pb-24 lg:pb-8">{children}</main>

        <nav className="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-6 border-t border-border bg-background/95 px-1 backdrop-blur-xl lg:hidden" aria-label="Primary navigation">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <PendingLink key={item.id} href={item.href} prefetch={item.id !== "practice"} indicatorClassName="absolute right-1.5 top-1.5 size-2.5" className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-md text-[0.65rem] font-medium transition-[color,background-color,transform] duration-150 ease-out active:scale-95 data-[pending=true]:bg-background data-[pending=true]:text-foreground motion-reduce:transform-none motion-reduce:transition-none ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                <Icon size={18} />
                <span className="truncate">{item.label}</span>
              </PendingLink>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

export const AppShell = StudentShell;

function SidebarContent({ active }: { active: AppSection }) {
  return (
    <div className="flex min-h-full flex-col p-4">
      <div className="px-2 pb-8 pt-1"><Brand href="/home" /></div>
      <nav aria-label="Primary navigation">
        <p className="px-3 pb-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Learn</p>
        <div className="space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <PendingLink key={item.id} href={item.href} prefetch={item.id !== "practice"} indicatorClassName="ml-auto" className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-[color,background-color,transform,box-shadow] duration-150 ease-out active:scale-[0.98] data-[pending=true]:bg-background data-[pending=true]:text-foreground data-[pending=true]:shadow-xs motion-reduce:transform-none motion-reduce:transition-none ${isActive ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:bg-background/70 hover:text-foreground"}`}>
                <Icon size={18} strokeWidth={1.8} />{item.label}
              </PendingLink>
            );
          })}
        </div>
      </nav>

      <div className="mt-auto space-y-3 pt-8">
        <Link href="/settings/profile" className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-[color,background-color,transform,box-shadow] duration-200 ease-out active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none ${active === "settings" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:bg-background/70 hover:text-foreground"}`}>
          <CircleUserRound size={18} />Account settings
        </Link>
      </div>
    </div>
  );
}

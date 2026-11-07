import { AppShell } from "@/components/app-shell";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { requireCurrentUser } from "@/lib/server/auth/current-user";

export const dynamic = "force-dynamic";

export default async function SecuritySettingsPage() {
  const user = await requireCurrentUser("/settings/security");
  return <AppShell user={user} active="settings" title="Security"><main className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 xl:px-12"><p className="text-xs font-bold uppercase tracking-[0.18em] text-base-content/42">Account settings</p><h2 className="mb-8 mt-2 font-serif text-4xl font-semibold tracking-[-0.04em]">Security</h2><ChangePasswordForm /></main></AppShell>;
}

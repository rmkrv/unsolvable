import { AppShell } from "@/components/app-shell";
import { SettingsPreview } from "@/components/settings-preview";
import { requireCurrentUser } from "@/lib/server/auth/current-user";
import { getUserBilling, getUserProfile } from "@/lib/server/users/user-service";

export const dynamic = "force-dynamic";

export default async function ProfileSettingsPage() {
  const user = await requireCurrentUser("/settings/profile");
  const [profile, billing] = await Promise.all([getUserProfile(user), getUserBilling(user)]);
  return (
    <AppShell user={user} active="settings" title="Settings">
      <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-10 xl:px-10">
        <div className="mb-7 border-b border-border pb-7">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Personal workspace</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground sm:text-4xl">Account settings</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">Manage your profile, security, billing, and account in one place.</p>
        </div>
        <SettingsPreview name={profile.displayName} email={user.email} isDiscoverable={profile.isDiscoverable} billingPlan={billing.plan} billingConnected={billing.isProviderConnected} />
      </div>
    </AppShell>
  );
}

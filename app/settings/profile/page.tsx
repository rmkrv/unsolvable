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
      <div className="mx-auto w-full max-w-6xl px-5 py-7 sm:px-8 sm:py-10 xl:px-12">
        <div className="mb-8">
          <div className="flex items-center gap-2"><p className="text-xs font-bold uppercase tracking-[0.18em] text-base-content/42">Personal workspace</p></div>
          <h2 className="mt-2 font-serif text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Account settings</h2>
          <p className="mt-3 max-w-2xl text-base leading-7 text-base-content/58">Manage how you appear, how you sign in, and what happens to your data.</p>
        </div>
        <SettingsPreview name={profile.displayName} email={user.email} isDiscoverable={profile.isDiscoverable} billingPlan={billing.plan} billingConnected={billing.isProviderConnected} />
      </div>
    </AppShell>
  );
}

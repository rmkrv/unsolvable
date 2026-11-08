import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SettingsPreview } from "@/components/settings-preview";

export default function SettingsDesignPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const user = {
    userId: "design-preview",
    displayName: "Maya Kim",
    fullName: "Maya Kim",
    email: "maya@example.test",
  };
  return (
    <AppShell user={user} active="settings" title="Settings">
      <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-10 xl:px-10">
        <div className="mb-7 border-b border-border pb-7">
          <div className="flex items-center gap-2"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Personal workspace</p><span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">Design preview</span></div>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground sm:text-4xl">Account settings</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">Manage your profile, security, billing, and account in one place.</p>
        </div>
        <SettingsPreview name={user.fullName} email={user.email} isPreview />
      </div>
    </AppShell>
  );
}

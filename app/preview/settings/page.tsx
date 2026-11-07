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
      <div className="mx-auto w-full max-w-6xl px-5 py-7 sm:px-8 sm:py-10 xl:px-12">
        <div className="mb-8">
          <div className="flex items-center gap-2"><p className="text-xs font-bold uppercase tracking-[0.18em] text-base-content/42">Personal workspace</p><span className="badge badge-outline badge-sm">Design preview</span></div>
          <h2 className="mt-2 font-serif text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Account settings</h2>
          <p className="mt-3 max-w-2xl text-base leading-7 text-base-content/58">Manage how you appear, how you sign in, and what happens to your data.</p>
        </div>
        <SettingsPreview name={user.fullName} email={user.email} isPreview />
      </div>
    </AppShell>
  );
}

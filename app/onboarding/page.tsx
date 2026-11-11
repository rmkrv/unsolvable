import { redirect } from "next/navigation";
import { RoleSelectionForm } from "@/components/role-selection-form";
import { requirePageViewer } from "@/lib/server/auth/viewer-service";
import { roleEntryPath } from "@/lib/server/auth/viewer";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const viewer = await requirePageViewer("/onboarding");
  if (viewer.roleConfirmedAt !== null) redirect(roleEntryPath(viewer.role));
  return (
    <main className="min-h-screen bg-base-200 px-5 py-16 text-base-content">
      <section className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-base-content/55">One-time setup</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">How will you use Unsolvable?</h1>
        <p className="mb-8 mt-3 max-w-2xl leading-7 text-base-content/60">Every account has one role. An administrator can change it later if necessary.</p>
        <RoleSelectionForm />
      </section>
    </main>
  );
}

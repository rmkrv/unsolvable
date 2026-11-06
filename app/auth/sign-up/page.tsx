import { AuthForm } from "@/components/auth/auth-form";

export const dynamic = "force-dynamic";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { redirectTo } = await searchParams;
  return (
    <main className="signin-shell">
      <section className="signin-card">
        <div className="brand-mark" aria-hidden="true"><span /><span /></div>
        <p>Unsolvable</p>
        <h1>Create your workspace.</h1>
        <span>Your account will own its boards and progress. Local Codex integration stays optional.</span>
        <AuthForm mode="sign-up" redirectTo={redirectTo} />
      </section>
    </main>
  );
}

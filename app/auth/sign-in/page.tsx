import { AuthForm } from "@/components/auth/auth-form";

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; client_id?: string; prompt?: string }>;
}) {
  const { redirectTo, client_id: clientId, prompt } = await searchParams;
  return (
    <main className="signin-shell">
      <section className="signin-card">
        <div className="brand-mark" aria-hidden="true"><span /><span /></div>
        <p>Unsolvable</p>
        <h1>Continue your engineering board.</h1>
        <span>Sign in to keep your boards, progress, and tutor activity connected to your account.</span>
        <AuthForm mode="sign-in" redirectTo={redirectTo} oauthVisit={Boolean(clientId)} oauthPrompt={prompt} />
      </section>
    </main>
  );
}

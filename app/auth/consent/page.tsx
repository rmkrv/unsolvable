import { OAuthConsent } from "@/components/auth/oauth-consent";

export const dynamic = "force-dynamic";

export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ client_id?: string; scope?: string }>;
}) {
  const { client_id: clientId = "", scope = "openid profile email offline_access" } = await searchParams;
  return (
    <main className="signin-shell">
      <section className="signin-card">
        <div className="brand-mark" aria-hidden="true"><span /><span /></div>
        <p>Unsolvable</p>
        <h1>Connect an AI assistant?</h1>
        <span>You can revoke this authorization later from your account settings.</span>
        <OAuthConsent clientId={clientId} scope={scope} />
      </section>
    </main>
  );
}

import { SignOutButton } from "@/components/auth/sign-out-button";

export const dynamic = "force-dynamic";

export default async function SignOutPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { redirectTo } = await searchParams;
  return (
    <main className="signin-shell">
      <section className="signin-card">
        <div className="brand-mark" aria-hidden="true" />
        <p>Unsolvable</p>
        <h1>Sign out?</h1>
        <span>Your saved boards will stay in your account.</span>
        <SignOutButton redirectTo={redirectTo} />
      </section>
    </main>
  );
}

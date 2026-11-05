import TutorBoard from "@/components/tutor-board";
import { getCurrentUser, signInPath } from "@/lib/server/auth/current-user";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <main className="signin-shell">
        <div className="signin-card">
          <div className="brand-mark" aria-hidden="true"><span /><span /></div>
          <p>Unsolvable engineering tutor</p>
          <h1>Your board connects to Codex through a private MCP plugin.</h1>
          <span>Sign in so the board and Codex connection resolve to the same user. No API key is used.</span>
          <a href={signInPath("/")} target="_top">Continue with ChatGPT</a>
        </div>
      </main>
    );
  }
  return <TutorBoard displayName={user.displayName} />;
}

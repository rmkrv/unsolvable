"use client";

import { useState } from "react";
import { safeReturnPath } from "@/lib/auth/return-path";
import { authClient } from "@/lib/client/auth/client";

export function SignOutButton({ redirectTo }: { redirectTo?: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut() {
    setPending(true);
    setError(null);
    const result = await authClient.signOut();
    if (result.error) {
      setError(result.error.message || "Could not sign out. Please try again.");
      setPending(false);
      return;
    }
    window.location.replace(safeReturnPath(redirectTo));
  }

  return (
    <div className="auth-form">
      {error && <div className="auth-error" role="alert">{error}</div>}
      <button type="button" disabled={pending} onClick={signOut}>
        {pending ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}

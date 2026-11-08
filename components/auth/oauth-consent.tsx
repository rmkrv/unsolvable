"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/client/auth/client";

export function OAuthConsent({ clientId, scope }: { clientId: string; scope: string }) {
  const [clientName, setClientName] = useState("AI assistant");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authClient.oauth2.publicClient({ query: { client_id: clientId } })
      .then(({ data }) => setClientName(data?.client_name || "AI assistant"))
      .catch(() => setError("This authorization request is no longer valid."));
  }, [clientId]);

  async function answer(accept: boolean) {
    setPending(true);
    setError(null);
    try {
      await authClient.oauth2.consent({ accept });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not complete authorization.");
      setPending(false);
    }
  }

  return (
    <div className="auth-form">
      <p><strong>{clientName}</strong> wants permission to work on your Unsolvable board.</p>
      <p>Requested access: {scope.split(" ").filter(Boolean).join(", ")}</p>
      {error && <div className="auth-error" role="alert">{error}</div>}
      <button type="button" disabled={pending} onClick={() => answer(true)}>Allow access</button>
      <button type="button" disabled={pending} onClick={() => answer(false)}>Deny</button>
    </div>
  );
}

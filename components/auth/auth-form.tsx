"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { safeReturnPath } from "@/lib/auth/return-path";
import { authClient } from "@/lib/client/auth/client";

type AuthMode = "sign-in" | "sign-up";

function authenticationError(reason: unknown) {
  if (reason && typeof reason === "object") {
    const status = Number((reason as { status?: unknown }).status);
    if (status >= 500) return "The authentication service is temporarily unavailable. Please try again.";
    const message = (reason as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return "Authentication failed. Please try again.";
}

export function AuthForm({
  mode,
  redirectTo,
  oauthVisit = false,
  oauthPrompt = "",
}: {
  mode: AuthMode;
  redirectTo?: string;
  oauthVisit?: boolean;
  oauthPrompt?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestedDestination = safeReturnPath(redirectTo);
  const destination = requestedDestination.startsWith("/app")
    ? requestedDestination
    : `/app?returnTo=${encodeURIComponent(requestedDestination)}`;
  const isSignUp = mode === "sign-up";

  useEffect(() => {
    if (!oauthVisit || isSignUp) return;
    const mustSignInAgain = /\b(login|create)\b/.test(oauthPrompt);
    if (mustSignInAgain) return;
    authClient.getSession().then(({ data: session }) => {
      if (session) return authClient.oauth2.continue({ selected: true });
    }).catch((reason: unknown) => {
      setError((reason as { status?: number } | undefined)?.status === 400
        ? "This authorization link has expired. Return to Codex and connect again."
        : "Could not continue authorization. Please try again.");
    });
  }, [isSignUp, oauthPrompt, oauthVisit]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const name = String(data.get("name") ?? "").trim();

    let result;
    try {
      result = isSignUp
        ? await authClient.signUp.email({ email, password, name })
        : await authClient.signIn.email({ email, password });
    } catch (reason) {
      setError(authenticationError(reason));
      setPending(false);
      return;
    }

    if (result.error) {
      setError(result.error.message || "Authentication failed. Please try again.");
      setPending(false);
      return;
    }

    if (oauthVisit) {
      try {
        const redirected = Boolean((result.data as { redirect?: boolean } | null | undefined)?.redirect);
        if (!redirected) await authClient.oauth2.continue({ selected: true });
      } catch (reason) {
        setError((reason as { status?: number } | undefined)?.status === 400
          ? "This authorization link has expired. Return to Codex and connect again."
          : "Could not continue authorization. Please try again.");
        setPending(false);
      }
      return;
    }
    window.location.assign(destination);
  }

  const alternatePath = isSignUp ? "/auth/sign-in" : "/auth/sign-up";
  const alternateLabel = isSignUp ? "Already have an account? Sign in" : "New to Unsolvable? Create an account";

  return (
    <form className="auth-form" onSubmit={submit}>
      {isSignUp && (
        <label>
          Name
          <input name="name" autoComplete="name" required maxLength={100} />
        </label>
      )}
      <label>
        Email
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        Password
        <input
          name="password"
          type="password"
          autoComplete={isSignUp ? "new-password" : "current-password"}
          required
          minLength={8}
        />
      </label>
      {error && <div className="auth-error" role="alert">{error}</div>}
      <button type="submit" disabled={pending}>
        {pending ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}
      </button>
      {!isSignUp && !oauthVisit && <Link href={`/auth/forgot-password?email=${encodeURIComponent("")}`}>Forgot your password?</Link>}
      {!oauthVisit && <Link href={`${alternatePath}?redirectTo=${encodeURIComponent(requestedDestination)}`}>{alternateLabel}</Link>}
    </form>
  );
}

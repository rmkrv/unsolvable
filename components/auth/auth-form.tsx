"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { safeReturnPath } from "@/lib/auth/return-path";
import { authClient } from "@/lib/client/auth/client";

type AuthMode = "sign-in" | "sign-up";

export function AuthForm({ mode, redirectTo }: { mode: AuthMode; redirectTo?: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const destination = safeReturnPath(redirectTo);
  const isSignUp = mode === "sign-up";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const name = String(data.get("name") ?? "").trim();

    const result = isSignUp
      ? await authClient.signUp.email({ email, password, name })
      : await authClient.signIn.email({ email, password });

    if (result.error) {
      setError(result.error.message || "Authentication failed. Please try again.");
      setPending(false);
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
      <Link href={`${alternatePath}?redirectTo=${encodeURIComponent(destination)}`}>{alternateLabel}</Link>
    </form>
  );
}

"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { authClient } from "@/lib/client/auth/client";

export function PasswordRecoveryForm({ mode, token = "", initialEmail = "" }: { mode: "request" | "reset"; token?: string; initialEmail?: string }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      if (mode === "request") {
        const email = String(data.get("email") || "").trim();
        const result = await authClient.requestPasswordReset({
          email,
          redirectTo: `${window.location.origin}/auth/reset-password`,
        });
        if (result.error) throw new Error(result.error.message || "Could not request a reset link.");
        setMessage("If an account exists for that address, a password-reset message is on its way.");
      } else {
        const newPassword = String(data.get("newPassword") || "");
        const confirmPassword = String(data.get("confirmPassword") || "");
        if (newPassword !== confirmPassword) throw new Error("The passwords do not match.");
        if (!token) throw new Error("This reset link is missing its token. Request a new one.");
        const result = await authClient.resetPassword({ newPassword, token });
        if (result.error) throw new Error(result.error.message || "Could not reset the password.");
        setMessage("Password updated. You can sign in now.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The request could not be completed.");
    } finally {
      setPending(false);
    }
  }

  return <form className="auth-form" onSubmit={submit}>
    {mode === "request" ? <label>Email<input name="email" type="email" autoComplete="email" defaultValue={initialEmail} required /></label> : <>
      <label>New password<input name="newPassword" type="password" autoComplete="new-password" minLength={8} required /></label>
      <label>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required /></label>
    </>}
    {message && <div className="auth-success" role="status">{message}</div>}
    {error && <div className="auth-error" role="alert">{error}</div>}
    <button type="submit" disabled={pending || Boolean(message)}>{pending ? "Please wait…" : mode === "request" ? "Send reset link" : "Set new password"}</button>
    <Link href="/auth/sign-in">Back to sign in</Link>
  </form>;
}

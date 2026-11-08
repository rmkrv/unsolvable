"use client";

import { FormEvent, useState } from "react";
import { Check } from "lucide-react";
import { authClient } from "@/lib/client/auth/client";

export function ChangePasswordForm() {
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setSaved(false);
    setError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const currentPassword = String(data.get("currentPassword") || "");
    const newPassword = String(data.get("newPassword") || "");
    const confirmPassword = String(data.get("confirmPassword") || "");
    if (newPassword !== confirmPassword) {
      setError("The new passwords do not match.");
      setPending(false);
      return;
    }
    try {
      const result = await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true });
      if (result.error) throw new Error(result.error.message || "Could not change the password.");
      form.reset();
      setSaved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not change the password.");
    } finally {
      setPending(false);
    }
  }

  return <form className="card card-border bg-base-100" onSubmit={submit}><div className="card-body max-w-2xl p-6 sm:p-8"><h2 className="card-title">Change password</h2><p className="text-sm text-base-content/52">Changing it signs out your other sessions.</p><fieldset className="fieldset mt-3"><legend className="fieldset-legend">Current password</legend><input className="input w-full" name="currentPassword" type="password" autoComplete="current-password" required /></fieldset><fieldset className="fieldset"><legend className="fieldset-legend">New password</legend><input className="input w-full" name="newPassword" type="password" autoComplete="new-password" minLength={8} required /></fieldset><fieldset className="fieldset"><legend className="fieldset-legend">Confirm new password</legend><input className="input w-full" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required /></fieldset>{saved && <div className="alert alert-success alert-soft" role="status"><Check size={18} />Password changed.</div>}{error && <div className="alert alert-error alert-soft" role="alert">{error}</div>}<div className="card-actions justify-end"><button className="btn btn-neutral" type="submit" disabled={pending}>{pending && <span className="loading loading-spinner loading-xs" />}Change password</button></div></div></form>;
}

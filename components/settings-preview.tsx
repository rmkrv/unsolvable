"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Check, CreditCard, LockKeyhole, Mail, ShieldAlert, UserRound } from "lucide-react";

export function SettingsPreview({
  name,
  email,
  isDiscoverable = false,
  billingPlan = "free",
  billingConnected = false,
  isPreview = false,
}: {
  name: string;
  email: string;
  isDiscoverable?: boolean;
  billingPlan?: string;
  billingConnected?: boolean;
  isPreview?: boolean;
}) {
  const [displayName, setDisplayName] = useState(name);
  const [discoverable, setDiscoverable] = useState(isDiscoverable);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    setError("");
    if (isPreview) {
      setStatus("saved");
      return;
    }
    try {
      const response = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName, isDiscoverable: discoverable }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not save your profile.");
      setStatus("saved");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save your profile.");
      setStatus("error");
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <form className="card card-border bg-base-100" onSubmit={submit}>
          <div className="card-body p-6 sm:p-8">
            <div className="flex items-start gap-4"><div className="flex size-10 shrink-0 items-center justify-center rounded-box bg-primary/10 text-primary"><UserRound size={20} /></div><div><h2 className="card-title">Profile</h2><p className="mt-1 text-sm text-base-content/52">How you appear in boards and collaboration.</p></div></div>
            <div className="divider my-2" />
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="avatar avatar-placeholder"><div className="flex size-20 items-center justify-center rounded-full bg-neutral text-xl font-bold text-neutral-content">{displayName.slice(0, 2).toUpperCase()}</div></div>
              <div><button className="btn btn-sm" type="button" disabled>Change avatar</button><p className="mt-2 text-xs leading-5 text-base-content/45">Avatar storage is not connected yet.</p></div>
            </div>
            <fieldset className="fieldset mt-2">
              <legend className="fieldset-legend">Display name</legend>
              <input className="input w-full" name="displayName" value={displayName} onChange={(event) => { setDisplayName(event.target.value); setStatus("idle"); }} maxLength={100} required />
              <p className="label">Visible to people you collaborate with.</p>
            </fieldset>
            <label className="flex cursor-pointer items-center justify-between gap-5 rounded-box border border-base-300 p-4">
              <span><span className="block text-sm font-semibold">Discoverable profile</span><span className="mt-1 block text-xs text-base-content/48">Allow other eligible learners to find you by name.</span></span>
              <input type="checkbox" className="toggle" checked={discoverable} onChange={(event) => { setDiscoverable(event.target.checked); setStatus("idle"); }} />
            </label>
            <fieldset className="fieldset">
              <legend className="fieldset-legend">Primary email</legend>
              <label className="input w-full"><Mail size={16} className="text-base-content/35" /><input value={email} readOnly /></label>
              <p className="label">Managed by your sign-in account.</p>
            </fieldset>
            {status === "saved" && <div role="status" className="alert alert-success alert-soft"><Check size={18} /><span>{isPreview ? "Preview state saved on this screen only." : "Profile changes saved."}</span></div>}
            {status === "error" && <div role="alert" className="alert alert-error alert-soft"><span>{error}</span></div>}
            <div className="card-actions justify-end"><button type="submit" className="btn btn-primary" disabled={status === "saving" || !displayName.trim()}>{status === "saving" && <span className="loading loading-spinner loading-xs" />}Save changes</button></div>
          </div>
        </form>

        <section className="card card-border bg-base-100">
          <div className="card-body p-6 sm:p-8">
            <div className="flex items-start gap-4"><div className="flex size-10 shrink-0 items-center justify-center rounded-box bg-base-200 text-base-content/65"><LockKeyhole size={20} /></div><div><h2 className="card-title">Security</h2><p className="mt-1 text-sm text-base-content/52">Password, recovery, and active sessions.</p></div></div>
            <div className="divider my-2" />
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-sm font-semibold">Password</p><p className="mt-1 text-xs text-base-content/48">Managed securely by Neon Auth.</p></div>{isPreview ? <button type="button" className="btn btn-sm" disabled>Change password</button> : <Link href="/settings/security" className="btn btn-sm">Change password</Link>}</div>
            <div className="divider my-1" />
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-sm font-semibold">Recovery email</p><p className="mt-1 text-xs text-base-content/48">Unavailable until a verified recovery provider is connected.</p></div><button type="button" className="btn btn-sm" disabled>Add recovery email</button></div>
          </div>
        </section>
      </div>

      <div className="space-y-6">
        <section className="card card-border bg-base-100">
          <div className="card-body p-6">
            <div className="flex items-center justify-between"><CreditCard size={20} className="text-base-content/45" /><span className="badge badge-outline badge-sm">{billingPlan} plan</span></div>
            <h2 className="card-title mt-3">Billing</h2>
            <p className="text-sm leading-6 text-base-content/52">Your plan, invoices, and payment method will live here when billing is connected.</p>
            <button type="button" className="btn mt-3" disabled={!billingConnected}>Manage billing</button>
          </div>
        </section>

        <section className="card border border-error/25 bg-error/5">
          <div className="card-body p-6">
            <ShieldAlert size={20} className="text-error" />
            <h2 className="card-title mt-2">Account</h2>
            <p className="text-sm leading-6 text-base-content/55">Export your data before permanently removing your account and boards.</p>
            <div className="card-actions mt-3 flex-col items-stretch"><button type="button" className="btn btn-sm" disabled>Export data</button><button type="button" className="btn btn-error btn-outline btn-sm" disabled>Remove account</button></div>
          </div>
        </section>
      </div>
    </div>
  );
}

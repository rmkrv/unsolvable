"use client";

import { FormEvent, useState } from "react";
import { Check, CreditCard, LockKeyhole, Mail, ShieldAlert, UserRound } from "lucide-react";

export function SettingsPreview({ name, email }: { name: string; email: string }) {
  const [saved, setSaved] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(true);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <form className="card card-border bg-base-100" onSubmit={submit}>
          <div className="card-body p-6 sm:p-8">
            <div className="flex items-start gap-4"><div className="flex size-10 shrink-0 items-center justify-center rounded-box bg-primary/10 text-primary"><UserRound size={20} /></div><div><h2 className="card-title">Profile</h2><p className="mt-1 text-sm text-base-content/52">How you appear in boards and collaboration.</p></div></div>
            <div className="divider my-2" />
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="avatar avatar-placeholder"><div className="flex size-20 items-center justify-center rounded-full bg-neutral text-xl font-bold text-neutral-content">{name.slice(0, 2).toUpperCase()}</div></div>
              <div><button className="btn btn-sm" type="button">Change avatar</button><p className="mt-2 text-xs leading-5 text-base-content/45">JPG, PNG, or WebP. Maximum 4 MB.</p></div>
            </div>
            <fieldset className="fieldset mt-2">
              <legend className="fieldset-legend">Display name</legend>
              <input className="input w-full" name="displayName" defaultValue={name} maxLength={100} />
              <p className="label">Visible to people you collaborate with.</p>
            </fieldset>
            <fieldset className="fieldset">
              <legend className="fieldset-legend">Primary email</legend>
              <label className="input w-full"><Mail size={16} className="text-base-content/35" /><input value={email} readOnly /></label>
              <p className="label">Managed by your sign-in account.</p>
            </fieldset>
            {saved && <div role="alert" className="alert alert-success alert-soft"><Check size={18} /><span>This design preview saved the form state for this screen only.</span></div>}
            <div className="card-actions justify-end"><button type="submit" className="btn btn-primary">Save changes</button></div>
          </div>
        </form>

        <section className="card card-border bg-base-100">
          <div className="card-body p-6 sm:p-8">
            <div className="flex items-start gap-4"><div className="flex size-10 shrink-0 items-center justify-center rounded-box bg-base-200 text-base-content/65"><LockKeyhole size={20} /></div><div><h2 className="card-title">Security</h2><p className="mt-1 text-sm text-base-content/52">Password, recovery, and active sessions.</p></div></div>
            <div className="divider my-2" />
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-sm font-semibold">Password</p><p className="mt-1 text-xs text-base-content/48">Use a unique password you do not use elsewhere.</p></div><button type="button" className="btn btn-sm">Change password</button></div>
            <div className="divider my-1" />
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-sm font-semibold">Recovery email</p><p className="mt-1 text-xs text-base-content/48">Not configured</p></div><button type="button" className="btn btn-sm">Add recovery email</button></div>
          </div>
        </section>
      </div>

      <div className="space-y-6">
        <section className="card card-border bg-base-100">
          <div className="card-body p-6">
            <div className="flex items-center justify-between"><CreditCard size={20} className="text-base-content/45" /><span className="badge badge-outline badge-sm">Free plan</span></div>
            <h2 className="card-title mt-3">Billing</h2>
            <p className="text-sm leading-6 text-base-content/52">Your plan, invoices, and payment method will live here when billing is connected.</p>
            <button type="button" className="btn mt-3" disabled>Manage billing</button>
          </div>
        </section>

        <section className="card border border-error/25 bg-error/5">
          <div className="card-body p-6">
            <ShieldAlert size={20} className="text-error" />
            <h2 className="card-title mt-2">Account</h2>
            <p className="text-sm leading-6 text-base-content/55">Export your data before permanently removing your account and boards.</p>
            <div className="card-actions mt-3 flex-col items-stretch"><button type="button" className="btn btn-sm">Export data</button><button type="button" className="btn btn-error btn-outline btn-sm">Remove account</button></div>
          </div>
        </section>
      </div>
    </div>
  );
}

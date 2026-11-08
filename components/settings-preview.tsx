"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import {
  Check,
  CreditCard,
  LockKeyhole,
  Mail,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

const sections = [
  { href: "#profile", label: "Profile", icon: UserRound },
  { href: "#security", label: "Security", icon: LockKeyhole },
  { href: "#billing", label: "Billing", icon: CreditCard },
  { href: "#account", label: "Account", icon: ShieldAlert },
];

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
    <Card className="overflow-hidden p-0 shadow-sm">
      <div className="grid lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="border-b border-border bg-muted/45 p-4 lg:border-b-0 lg:border-r lg:p-5">
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar className="size-11"><AvatarFallback className="bg-primary text-primary-foreground">{displayName.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
            <div className="min-w-0"><p className="truncate text-sm font-semibold">{displayName}</p><p className="truncate text-xs text-muted-foreground">{email}</p></div>
          </div>
          <nav className="mt-5 grid grid-cols-2 gap-1 lg:grid-cols-1" aria-label="Settings sections">
            {sections.map((section, index) => {
              const Icon = section.icon;
              return (
                <a key={section.href} href={section.href} className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-[color,background-color,transform,box-shadow] duration-200 ease-out active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none ${index === 0 ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:bg-background/70 hover:text-foreground"}`}>
                  <Icon size={16} />{section.label}
                </a>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0">
          <form id="profile" className="scroll-mt-24 p-6 sm:p-8" onSubmit={submit}>
            <SettingsSectionHeader title="Profile" description="Your name and how people can find you." icon={UserRound} />
            <div className="mt-7 max-w-2xl space-y-6">
              <div className="grid gap-2">
                <Label htmlFor="display-name">Display name</Label>
                <Input id="display-name" name="displayName" value={displayName} onChange={(event) => { setDisplayName(event.target.value); setStatus("idle"); }} maxLength={100} required />
                <p className="text-xs text-muted-foreground">Visible to people you collaborate with.</p>
              </div>

              <div className="flex items-center justify-between gap-5 rounded-lg border border-border p-4">
                <div><Label htmlFor="discoverable-profile">Discoverable profile</Label><p className="mt-1.5 text-xs leading-5 text-muted-foreground">Allow other eligible learners to find you by name.</p></div>
                <Switch id="discoverable-profile" checked={discoverable} onCheckedChange={(checked) => { setDiscoverable(checked); setStatus("idle"); }} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="primary-email">Primary email</Label>
                <div className="relative"><Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} /><Input id="primary-email" className="pl-9" value={email} readOnly /></div>
                <p className="text-xs text-muted-foreground">Managed by your sign-in account.</p>
              </div>

              {status === "saved" && <div role="status" className="flex items-center gap-2 rounded-lg bg-primary/8 px-3 py-2 text-sm text-primary"><Check size={16} /><span>{isPreview ? "Preview state saved on this screen only." : "Profile changes saved."}</span></div>}
              {status === "error" && <div role="alert" className="rounded-lg bg-destructive/8 px-3 py-2 text-sm text-destructive">{error}</div>}

              <div className="flex justify-end"><Button type="submit" disabled={status === "saving" || !displayName.trim()}>{status === "saving" && <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" />}Save changes</Button></div>
            </div>
          </form>

          <Separator />

          <section id="security" className="scroll-mt-24 p-6 sm:p-8">
            <SettingsSectionHeader title="Security" description="Password, recovery, and active sessions." icon={LockKeyhole} />
            <div className="mt-7 max-w-2xl divide-y divide-border rounded-lg border border-border">
              <SettingsRow title="Password" description="Managed securely by Neon Auth.">
                {isPreview ? <Button variant="outline" size="sm" disabled>Change password</Button> : <Button asChild variant="outline" size="sm"><Link href="/settings/security">Change password</Link></Button>}
              </SettingsRow>
              <SettingsRow title="Recovery email" description="Available after a verified recovery provider is connected."><Button variant="outline" size="sm" disabled>Add recovery email</Button></SettingsRow>
            </div>
          </section>

          <Separator />

          <section id="billing" className="scroll-mt-24 p-6 sm:p-8">
            <SettingsSectionHeader title="Billing" description="Plan, invoices, and payment method." icon={CreditCard} />
            <div className="mt-7 flex max-w-2xl flex-col justify-between gap-4 rounded-lg border border-border p-4 sm:flex-row sm:items-center">
              <div><div className="flex items-center gap-2"><p className="text-sm font-medium">Current plan</p><Badge variant="secondary">{billingPlan}</Badge></div><p className="mt-1.5 text-xs text-muted-foreground">Billing controls will appear here when a provider is connected.</p></div>
              <Button variant="outline" size="sm" disabled={!billingConnected}>Manage billing</Button>
            </div>
          </section>

          <Separator />

          <section id="account" className="scroll-mt-24 p-6 sm:p-8">
            <SettingsSectionHeader title="Account" description="Permanently remove this workspace." icon={ShieldAlert} />
            <div className="mt-7 flex max-w-2xl flex-col justify-between gap-4 rounded-lg border border-destructive/20 p-4 sm:flex-row sm:items-center">
              <div><p className="text-sm font-medium">Remove account</p><p className="mt-1.5 text-xs leading-5 text-muted-foreground">Permanently removes your account and boards. This action cannot be undone.</p></div>
              <Button className="shrink-0" variant="destructive" size="sm" disabled>Remove</Button>
            </div>
          </section>
        </div>
      </div>
    </Card>
  );
}

function SettingsSectionHeader({ title, description, icon: Icon }: { title: string; description: string; icon: typeof UserRound }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground"><Icon size={18} /></div>
      <div><h2 className="text-lg font-semibold tracking-tight">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>
    </div>
  );
}

function SettingsRow({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center">
      <div><p className="text-sm font-medium">{title}</p><p className="mt-1 text-xs text-muted-foreground">{description}</p></div>
      {children}
    </div>
  );
}

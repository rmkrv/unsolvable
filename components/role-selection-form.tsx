"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RoleSelectionForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function select(role: "student" | "parent") {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/account/role-selection", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const payload = await response.json() as { entryPath?: string; error?: { message?: string } };
      if (!response.ok || !payload.entryPath) throw new Error(payload.error?.message || "Could not save your role.");
      router.replace(payload.entryPath);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save your role.");
      setPending(false);
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <button className="card card-border bg-base-100 text-left transition hover:-translate-y-0.5 hover:shadow-lg" disabled={pending} onClick={() => select("student")}>
        <span className="card-body">
          <span className="badge badge-soft">Student</span>
          <span className="card-title">I am learning</span>
          <span className="text-sm leading-6 text-base-content/60">Use boards, practice, progress, and your own billing account.</span>
        </span>
      </button>
      <button className="card card-border bg-base-100 text-left transition hover:-translate-y-0.5 hover:shadow-lg" disabled={pending} onClick={() => select("parent")}>
        <span className="card-body">
          <span className="badge badge-soft">Parent</span>
          <span className="card-title">I support a student</span>
          <span className="text-sm leading-6 text-base-content/60">View summaries for linked students and manage your own billing account.</span>
        </span>
      </button>
      {error && <div className="alert alert-error sm:col-span-2" role="alert">{error}</div>}
    </div>
  );
}

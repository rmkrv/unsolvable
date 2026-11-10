import Link from "next/link";
import { ParentShell } from "@/components/role-shell";
import { requireRolePage } from "@/lib/server/auth/viewer-service";
import { getParentHome } from "@/lib/server/parents/parent-dashboard-service";
import { getBilling } from "@/lib/server/billing/billing-service";

export const dynamic = "force-dynamic";

export default async function ParentDashboardPage() {
  const viewer = await requireRolePage("/parent", "parent");
  const [home, billing] = await Promise.all([getParentHome(viewer), getBilling(viewer)]);
  const active = home.students.filter((student) => student.status === "active");
  const pending = home.students.filter((student) => student.status === "pending");
  const revoked = home.students.filter((student) => student.status === "revoked");

  return (
    <ParentShell viewer={viewer} title="Overview">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-base-content/50">Family learning overview</p>
          <h2 className="mt-2 text-4xl font-semibold tracking-tight">Parent dashboard</h2>
          <p className="mt-3 max-w-2xl text-base-content/60">Only actively linked students appear in performance and attendance summaries.</p>
        </div>
      </div>

      <section className="stats stats-vertical mt-8 w-full border border-base-300 bg-base-100 sm:stats-horizontal">
        <div className="stat"><div className="stat-title">Active students</div><div className="stat-value">{home.activeCount}</div><div className="stat-desc">Summary access granted</div></div>
        <div className="stat"><div className="stat-title">Pending invitations</div><div className="stat-value">{home.pendingCount}</div><div className="stat-desc">No summary access yet</div></div>
        <div className="stat"><div className="stat-title">Billing plan</div><div className="stat-value text-2xl">{billing.plan}</div><div className="stat-desc">Owned by this parent account</div></div>
      </section>

      <section id="students" className="mt-10 scroll-mt-24">
        <h3 className="text-2xl font-semibold">Students</h3>
        {active.length ? (
          <ul className="list mt-4 rounded-box border border-base-300 bg-base-100">
            {active.map((student) => (
              <li className="list-row" key={student.linkId}>
                <div className="flex size-10 items-center justify-center rounded-box bg-base-200 font-semibold">{student.displayName.slice(0, 1).toUpperCase()}</div>
                <div><p className="font-semibold">{student.displayName}</p><p className="text-sm text-base-content/55">Linked for attendance and performance summaries</p></div>
                <Link className="btn btn-sm" href={`/parent/students/${student.studentId}`}>View summary</Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="card card-border mt-4 bg-base-100"><div className="card-body"><h4 className="card-title">No active student links</h4><p className="text-base-content/60">A student must explicitly accept an invitation before summaries become available.</p></div></div>
        )}
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="card card-border bg-base-100" id="attendance"><div className="card-body"><h3 className="card-title">Attendance</h3><p className="text-base-content/60">Activity means a practice session was started. Completion means it has a completion timestamp; no missed-session claims are made.</p></div></section>
        <section className="card card-border bg-base-100" id="performance"><div className="card-body"><h3 className="card-title">Performance</h3><p className="text-base-content/60">Purpose-built mastery aggregates are available per active student. Raw boards and tutor conversations stay private.</p></div></section>
        <section className="card card-border bg-base-100" id="planning"><div className="card-body"><h3 className="card-title">Planning</h3><p className="text-base-content/60">Create and edit study sessions, deadlines, reminders, and recurring plans for actively linked students.</p><div className="card-actions"><Link className="btn btn-sm" href="/parent/planning">Open schedule</Link></div></div></section>
        <section className="card card-border bg-base-100" id="billing"><div className="card-body"><div className="flex items-center gap-2"><h3 className="card-title">Billing</h3><span className="badge badge-soft">Owner</span></div><p className="text-base-content/60">{billing.plan} · {billing.status}. Beneficiary access is separate from student-summary permission.</p></div></section>
      </div>

      <section id="settings" className="card card-border mt-8 bg-base-100 scroll-mt-24"><div className="card-body"><h3 className="card-title">Account settings</h3><p className="text-base-content/60">Signed in as {viewer.email}. Profile and security controls are account-scoped; student data is never exposed here.</p></div></section>

      {(pending.length > 0 || revoked.length > 0) && (
        <section className="mt-8">
          <h3 className="text-lg font-semibold">Link history</h3>
          <div className="overflow-x-auto mt-3 rounded-box border border-base-300 bg-base-100">
            <table className="table table-sm">
              <thead><tr><th>Student</th><th>Status</th><th>Invited</th></tr></thead>
              <tbody>
                {[...pending, ...revoked].map((student) => <tr key={student.linkId}><td>{student.displayName}</td><td><span className={`badge badge-soft ${student.status === "pending" ? "badge-warning" : ""}`}>{student.status}</span></td><td>{new Date(student.invitedAt).toLocaleDateString()}</td></tr>)}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </ParentShell>
  );
}

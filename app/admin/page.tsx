import { AdminShell } from "@/components/role-shell";
import { requireRolePage } from "@/lib/server/auth/viewer-service";
import { listAdminLinks, listAdminUsers, listAuditEvents } from "@/lib/server/admin/admin-service";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const viewer = await requireRolePage("/admin", "admin");
  const [users, links, events] = await Promise.all([
    listAdminUsers(viewer, 50),
    listAdminLinks(viewer, 50),
    listAuditEvents(viewer, 50),
  ]);
  return (
    <AdminShell viewer={viewer} title="Operations">
      <p className="text-sm font-semibold uppercase tracking-widest text-base-content/50">Internal operations</p>
      <h2 className="mt-2 text-4xl font-semibold tracking-tight">Administration</h2>
      <p className="mt-3 max-w-2xl text-base-content/60">Dedicated role and relationship lookup. Customer APIs are not bypassed, and impersonation is not available.</p>

      <section id="users" className="mt-10 scroll-mt-24">
        <h3 className="text-2xl font-semibold">Users</h3>
        <div className="overflow-x-auto mt-4 rounded-box border border-base-300 bg-base-100">
          <table className="table table-sm"><thead><tr><th>Name</th><th>Role</th><th>Application ID</th><th>Created</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td>{user.displayName}</td><td><span className="badge badge-soft">{user.role}</span></td><td className="font-mono text-xs">{user.id}</td><td>{new Date(user.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table>
        </div>
      </section>

      <section id="relationships" className="mt-10 scroll-mt-24">
        <h3 className="text-2xl font-semibold">Parent-student relationships</h3>
        <div className="overflow-x-auto mt-4 rounded-box border border-base-300 bg-base-100">
          <table className="table table-sm"><thead><tr><th>Parent</th><th>Student</th><th>Status</th><th>Invited</th></tr></thead><tbody>{links.map((link) => <tr key={link.id}><td className="font-mono text-xs">{link.parentUserId}</td><td className="font-mono text-xs">{link.studentUserId}</td><td><span className="badge badge-soft">{link.status}</span></td><td>{new Date(link.invitedAt).toLocaleDateString()}</td></tr>)}</tbody></table>
        </div>
      </section>

      <section id="billing" className="card card-border mt-10 bg-base-100 scroll-mt-24"><div className="card-body"><h3 className="card-title">Billing support</h3><p className="text-base-content/60">Billing ownership and beneficiary entitlements are separate. Provider identifiers remain inside billing services and are not shown in this dashboard.</p></div></section>

      <section id="audit" className="mt-10 scroll-mt-24">
        <h3 className="text-2xl font-semibold">Audit events</h3>
        <div className="overflow-x-auto mt-4 rounded-box border border-base-300 bg-base-100">
          <table className="table table-sm"><thead><tr><th>Action</th><th>Actor</th><th>Target</th><th>Time</th></tr></thead><tbody>{events.map((event) => <tr key={event.id}><td>{event.action}</td><td className="font-mono text-xs">{event.actorUserId || "system"}</td><td className="font-mono text-xs">{event.targetId}</td><td>{new Date(event.createdAt).toLocaleString()}</td></tr>)}</tbody></table>
        </div>
      </section>

      <section id="settings" className="card card-border mt-10 bg-base-100 scroll-mt-24"><div className="card-body"><h3 className="card-title">Admin account</h3><p className="text-base-content/60">Signed in as {viewer.email}. Admin assignment is available only through confirmed, audited admin operations.</p></div></section>
    </AdminShell>
  );
}

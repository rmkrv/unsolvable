import { ParentShell } from "@/components/role-shell";
import { requireRolePage } from "@/lib/server/auth/viewer-service";
import {
  getLinkedStudentAttendance,
  getLinkedStudentPerformance,
  getParentStudents,
} from "@/lib/server/parents/parent-dashboard-service";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LinkedStudentPage({ params }: { params: Promise<{ studentId: string }> }) {
  const viewer = await requireRolePage("/parent", "parent");
  const { studentId } = await params;
  const students = await getParentStudents(viewer, 100);
  const student = students.find((candidate) => candidate.studentId === studentId && candidate.status === "active");
  if (!student) notFound();
  const [performance, attendance] = await Promise.all([
    getLinkedStudentPerformance(viewer, studentId),
    getLinkedStudentAttendance(viewer, studentId, 30),
  ]);
  return (
    <ParentShell viewer={viewer} title={student.displayName}>
      <p className="text-sm font-semibold uppercase tracking-widest text-base-content/50">Linked student summary</p>
      <h2 className="mt-2 text-4xl font-semibold tracking-tight">{student.displayName}</h2>
      <section className="stats stats-vertical mt-8 w-full border border-base-300 bg-base-100 sm:stats-horizontal">
        <div className="stat"><div className="stat-title">Average mastery</div><div className="stat-value">{performance.averageMastery ?? "—"}{performance.averageMastery === null ? "" : "%"}</div><div className="stat-desc">Across {performance.skillsMeasured} measured skills</div></div>
        <div className="stat"><div className="stat-title">Recent activity</div><div className="stat-value">{attendance.activityCount}</div><div className="stat-desc">{attendance.completedCount} completed sessions</div></div>
        <div className="stat"><div className="stat-title">Evidence</div><div className="stat-value">{performance.totalEvidence}</div><div className="stat-desc">Aggregate learning evidence</div></div>
      </section>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="card card-border bg-base-100"><div className="card-body"><h3 className="card-title">Performance</h3>{performance.weakSpots.length ? <ul className="list">{performance.weakSpots.slice(0, 8).map((spot) => <li className="list-row" key={spot.skillId}><div><p className="font-medium">{spot.skillName}</p><p className="text-xs text-base-content/50">{spot.evidenceCount} evidence points</p></div><span className="badge badge-soft">{spot.score}%</span></li>)}</ul> : <p className="text-base-content/60">No mastery evidence yet.</p>}</div></section>
        <section className="card card-border bg-base-100"><div className="card-body"><h3 className="card-title">Attendance</h3>{attendance.entries.length ? <ul className="list">{attendance.entries.map((entry) => <li className="list-row" key={entry.sessionId}><div><p className="font-medium">{entry.activityDate}</p><p className="text-xs text-base-content/50">{entry.durationMs === null ? "Duration unavailable" : `${Math.round(entry.durationMs / 60_000)} minutes`}</p></div><span className={`badge badge-soft ${entry.completed ? "badge-success" : "badge-warning"}`}>{entry.completed ? "Completed" : "Started"}</span></li>)}</ul> : <p className="text-base-content/60">No practice activity yet.</p>}</div></section>
      </div>
    </ParentShell>
  );
}

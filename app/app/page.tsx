import { redirect } from "next/navigation";
import { safeReturnPath } from "@/lib/auth/return-path";
import { requirePageViewer } from "@/lib/server/auth/viewer-service";
import { roleEntryPath, type AccountRole } from "@/lib/server/auth/viewer";

export const dynamic = "force-dynamic";

export default async function RoleEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const viewer = await requirePageViewer("/app");
  const { returnTo } = await searchParams;
  if (viewer.roleConfirmedAt === null) redirect("/onboarding");
  const requested = safeReturnPath(returnTo);
  redirect(isAllowedReturnPath(viewer.role, requested) ? requested : roleEntryPath(viewer.role));
}

function isAllowedReturnPath(role: AccountRole, path: string) {
  if (role === "parent") return path === "/parent" || path.startsWith("/parent/") || path.startsWith("/parent#");
  if (role === "admin") return path === "/admin" || path.startsWith("/admin/") || path.startsWith("/admin#");
  return ["/home", "/boards", "/analysis", "/weak-spots", "/friends", "/settings"].some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`) || path.startsWith(`${prefix}#`),
  );
}

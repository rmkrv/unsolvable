import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth/current-user";
import { loadHomeOverview, loadRecentBoards } from "@/lib/server/home/dashboard-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view Home." }, { status: 401 });
  try {
    const [recentBoards, { insights, profile }] = await Promise.all([
      loadRecentBoards(user.userId),
      loadHomeOverview(user.userId, user.fullName || user.displayName),
    ]);
    return NextResponse.json({ profile, recentBoards, ...insights });
  } catch {
    return NextResponse.json({ error: "Could not load Home." }, { status: 500 });
  }
}

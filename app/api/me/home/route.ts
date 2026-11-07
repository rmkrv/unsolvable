import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth/current-user";
import { listUserBoards } from "@/lib/server/boards/board-service";
import { getHomeInsights, getUserProfile } from "@/lib/server/users/user-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view Home." }, { status: 401 });
  try {
    const [recentBoards, insights, profile] = await Promise.all([
      listUserBoards(user.userId, 5),
      getHomeInsights(user),
      getUserProfile(user),
    ]);
    return NextResponse.json({ profile, recentBoards, ...insights });
  } catch {
    return NextResponse.json({ error: "Could not load Home." }, { status: 500 });
  }
}

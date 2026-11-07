import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/server/auth/current-user";
import { isSameOrigin } from "@/lib/server/auth/request-identity";
import { getUserBilling, getUserProfile, updateUserProfile } from "@/lib/server/users/user-service";

export const dynamic = "force-dynamic";

const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1).max(100),
  isDiscoverable: z.boolean(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view your profile." }, { status: 401 });
  try {
    const [profile, billing] = await Promise.all([getUserProfile(user), getUserBilling(user)]);
    return NextResponse.json({ profile, billing, email: user.email });
  } catch {
    return NextResponse.json({ error: "Could not load your profile." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Cross-origin write rejected." }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to update your profile." }, { status: 401 });
  const parsed = updateProfileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a display name between 1 and 100 characters." }, { status: 400 });
  }
  try {
    const profile = await updateUserProfile(user, parsed.data);
    return NextResponse.json({ profile });
  } catch {
    return NextResponse.json({ error: "Could not save your profile." }, { status: 500 });
  }
}

import { Suspense } from "react";
import {
  FriendsHomeCard,
  HomeDashboardHeader,
  HomePageFrame,
  PrimaryHomeSection,
  QuickStartSection,
  RecentBoardsHomeCard,
} from "@/components/home-dashboard";
import {
  FriendsCardSkeleton,
  HomeHeaderSkeleton,
  PrimarySectionSkeleton,
  RecentBoardsSkeleton,
} from "@/components/home-dashboard-loading";
import { requireCurrentUser, type AuthenticatedUser } from "@/lib/server/auth/current-user";
import { loadHomeOverview, loadRecentBoards } from "@/lib/server/home/dashboard-data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await requireCurrentUser("/home");

  return (
    <HomePageFrame user={user}>
      <Suspense fallback={<HomeHeaderSkeleton />}>
        <PersonalizedHeader user={user} />
      </Suspense>

      <Suspense fallback={<PrimarySectionSkeleton />}>
        <PrimaryDashboard user={user} />
      </Suspense>

      <section className="mt-5 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <Suspense fallback={<FriendsCardSkeleton />}>
          <FriendsDashboard user={user} />
        </Suspense>
        <Suspense fallback={<RecentBoardsSkeleton />}>
          <RecentBoardsDashboard userId={user.userId} />
        </Suspense>
      </section>

      <QuickStartSection />
    </HomePageFrame>
  );
}

async function PersonalizedHeader({ user }: { user: AuthenticatedUser }) {
  const { profile } = await loadHomeOverview(user.userId, displayNameFor(user));
  return <HomeDashboardHeader user={{ ...user, displayName: profile.displayName, fullName: profile.displayName }} />;
}

async function PrimaryDashboard({ user }: { user: AuthenticatedUser }) {
  const [recentBoards, { insights }] = await Promise.all([
    loadRecentBoards(user.userId),
    loadHomeOverview(user.userId, displayNameFor(user)),
  ]);
  return <PrimaryHomeSection recentBoards={recentBoards} insights={insights} />;
}

async function FriendsDashboard({ user }: { user: AuthenticatedUser }) {
  const { insights } = await loadHomeOverview(user.userId, displayNameFor(user));
  return <FriendsHomeCard insights={insights} />;
}

async function RecentBoardsDashboard({ userId }: { userId: string }) {
  const recentBoards = await loadRecentBoards(userId);
  return <RecentBoardsHomeCard recentBoards={recentBoards} />;
}

function displayNameFor(user: AuthenticatedUser) {
  return user.fullName || user.displayName;
}

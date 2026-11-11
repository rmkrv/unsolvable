import { Suspense } from "react";
import {
  HomeDashboardHeader,
  HomePageFrame,
  PrimaryHomeSection,
  QuickStartSection,
  RecentBoardsHomeCard,
} from "@/components/home-dashboard";
import {
  HomeHeaderSkeleton,
  PrimarySectionSkeleton,
  RecentBoardsSkeleton,
} from "@/components/home-dashboard-loading";
import { requireRolePage } from "@/lib/server/auth/viewer-service";
import type { Viewer } from "@/lib/server/auth/viewer";
import { loadHomeOverview, loadRecentBoards } from "@/lib/server/home/dashboard-data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await requireRolePage("/home", "student");

  return (
    <HomePageFrame user={user}>
      <Suspense fallback={<HomeHeaderSkeleton />}>
        <PersonalizedHeader user={user} />
      </Suspense>

      <Suspense fallback={<PrimarySectionSkeleton />}>
        <PrimaryDashboard user={user} />
      </Suspense>

      <QuickStartSection />
      <Suspense fallback={<RecentBoardsSkeleton />}>
        <RecentBoardsDashboard user={user} />
      </Suspense>
    </HomePageFrame>
  );
}

async function PersonalizedHeader({ user }: { user: Viewer }) {
  const { profile } = await loadHomeOverview(user);
  return <HomeDashboardHeader user={{ ...user, displayName: profile.displayName, fullName: profile.displayName }} />;
}

async function PrimaryDashboard({ user }: { user: Viewer }) {
  const [recentBoards, { insights }] = await Promise.all([
    loadRecentBoards(user),
    loadHomeOverview(user),
  ]);
  return <PrimaryHomeSection recentBoards={recentBoards} insights={insights} />;
}

async function RecentBoardsDashboard({ user }: { user: Viewer }) {
  const recentBoards = await loadRecentBoards(user);
  return <RecentBoardsHomeCard recentBoards={recentBoards} />;
}

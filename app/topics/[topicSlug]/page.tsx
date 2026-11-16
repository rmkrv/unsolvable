import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { TopicTestLauncher } from "@/components/topics/topic-test-launcher";
import { findMathTopic } from "@/lib/domain/math-curriculum.ts";
import { requireRolePage } from "@/lib/server/auth/viewer-service";

export const dynamic = "force-dynamic";

export default async function TopicPage({ params }: { params: Promise<{ topicSlug: string }> }) {
  const { topicSlug } = await params;
  const topic = findMathTopic(topicSlug);
  if (!topic) notFound();
  const user = await requireRolePage(`/topics/${topicSlug}`, "student");

  return <AppShell user={user} active="topics" title={topic.name}>
    <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 xl:px-12">
      <header className="rounded-3xl border border-primary/10 bg-gradient-to-br from-primary/10 via-accent/70 to-card p-6 sm:p-8">
        <Link href="/topics" className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-white hover:text-foreground"><ArrowLeft className="size-4" />Topics</Link>
        <h2 className="mt-5 text-4xl font-medium tracking-[-0.04em]">{topic.name}</h2>
        <p className="mt-3 text-sm text-muted-foreground">Choose a subtopic, then start in preparation or test mode.</p>
      </header>
      <TopicTestLauncher topic={topic} />
    </main>
  </AppShell>;
}

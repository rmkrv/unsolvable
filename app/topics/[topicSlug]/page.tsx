import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpen } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
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
        <p className="mt-3 text-sm text-muted-foreground">Choose from the subtopics below.</p>
      </header>
      <section className="mt-8 grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label={`${topic.name} subtopics`}>
        {topic.subtopics.map((subtopic) => <Card key={subtopic} className="group h-full min-h-44 justify-center overflow-hidden border-primary/15 bg-gradient-to-br from-accent/80 via-card to-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_18px_45px_-24px_rgba(47,91,234,0.65)]">
          <CardContent className="flex flex-col gap-6"><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground"><BookOpen className="size-5" aria-hidden="true" /></span><CardTitle className="text-lg font-medium leading-7 text-foreground/80">{subtopic}</CardTitle></CardContent>
        </Card>)}
      </section>
    </main>
  </AppShell>;
}

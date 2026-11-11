import Link from "next/link";
import { ArrowRight, Calculator, ChartNoAxesColumnIncreasing, ChartSpline, Shapes, Triangle, Variable } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { mathTopics } from "@/lib/domain/math-curriculum.ts";
import { requireRolePage } from "@/lib/server/auth/viewer-service";

export const dynamic = "force-dynamic";

const topicLooks = [
  { Icon: Calculator, card: "border-sky-200 bg-gradient-to-br from-sky-100 via-white to-cyan-50 group-hover:border-sky-400 group-hover:shadow-sky-200/70", icon: "bg-sky-600 shadow-sky-200" },
  { Icon: Variable, card: "border-violet-200 bg-gradient-to-br from-violet-100 via-white to-fuchsia-50 group-hover:border-violet-400 group-hover:shadow-violet-200/70", icon: "bg-violet-600 shadow-violet-200" },
  { Icon: Shapes, card: "border-amber-200 bg-gradient-to-br from-amber-100 via-white to-orange-50 group-hover:border-amber-400 group-hover:shadow-amber-200/70", icon: "bg-amber-500 shadow-amber-200" },
  { Icon: Triangle, card: "border-rose-200 bg-gradient-to-br from-rose-100 via-white to-pink-50 group-hover:border-rose-400 group-hover:shadow-rose-200/70", icon: "bg-rose-500 shadow-rose-200" },
  { Icon: ChartSpline, card: "border-emerald-200 bg-gradient-to-br from-emerald-100 via-white to-teal-50 group-hover:border-emerald-400 group-hover:shadow-emerald-200/70", icon: "bg-emerald-600 shadow-emerald-200" },
  { Icon: ChartNoAxesColumnIncreasing, card: "border-indigo-200 bg-gradient-to-br from-indigo-100 via-white to-blue-50 group-hover:border-indigo-400 group-hover:shadow-indigo-200/70", icon: "bg-indigo-600 shadow-indigo-200" },
] as const;

export default async function TopicsPage() {
  const user = await requireRolePage("/topics", "student");
  return <AppShell user={user} active="topics" title="Topics">
    <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 xl:px-12">
      <header className="rounded-3xl border border-primary/10 bg-gradient-to-br from-primary/10 via-accent/70 to-card p-6 sm:p-8">
        <p className="text-sm font-medium text-primary">Math curriculum</p>
        <h2 className="mt-2 text-4xl font-medium tracking-[-0.04em]">Topics</h2>
        <p className="mt-3 text-sm text-muted-foreground">Choose a topic to see its subtopics.</p>
      </header>
      <section className="mt-8 grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Math topics">
        {mathTopics.map((topic, index) => {
          const { Icon, card, icon } = topicLooks[index];
          return <Link key={topic.slug} href={`/topics/${topic.slug}`} className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <Card className={`relative h-full min-h-52 overflow-hidden shadow-sm transition-all duration-300 group-hover:-translate-y-1.5 group-hover:shadow-xl ${card}`}>
            <div className="absolute -right-10 -top-10 size-32 rounded-full bg-white/40" />
            <CardContent className="relative flex h-full flex-col justify-between gap-8">
              <div className="flex items-start justify-between">
                <span className={`grid size-12 place-items-center rounded-2xl text-white shadow-lg ${icon}`}><Icon className="size-6" aria-hidden="true" /></span>
                <span className="grid size-9 place-items-center rounded-full bg-white/70 text-foreground/60 transition-all duration-300 group-hover:bg-white group-hover:text-foreground"><ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" /></span>
              </div>
              <div><CardTitle className="text-xl font-medium leading-7 tracking-tight text-foreground/85">{topic.name}</CardTitle><p className="mt-2 text-sm leading-5 text-muted-foreground">{topic.description}</p></div>
            </CardContent>
          </Card>
        </Link>})}
      </section>
    </main>
  </AppShell>;
}

"use client";

import { BookOpen, Brain, ChevronRight, LoaderCircle, ShieldCheck, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { TopicTestMode } from "@/lib/domain/topic-test";

export function TopicTestLauncher({
  topic,
}: {
  topic: { slug: string; name: string; subtopics: readonly string[] };
}) {
  const router = useRouter();
  const [subtopic, setSubtopic] = useState<string>();
  const [mode, setMode] = useState<TopicTestMode>("preparation");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  function open(value: string) {
    setSubtopic(value);
    setMode("preparation");
    setError("");
  }

  async function start() {
    if (!subtopic || creating) return;
    setCreating(true);
    setError("");
    try {
      const response = await fetch("/api/student/boards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: `${subtopic} — ${mode === "test" ? "Test" : "Preparation"}`.slice(0, 120),
          topicTest: { topicSlug: topic.slug, topicName: topic.name, subtopic, mode },
        }),
      });
      const payload = await response.json() as { board?: { boardId: string }; error?: { message?: string } };
      if (!response.ok || !payload.board) throw new Error(payload.error?.message || "Could not start the test.");
      router.push(`/boards/${encodeURIComponent(payload.board.boardId)}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not start the test.");
      setCreating(false);
    }
  }

  return (
    <>
      <section className="mt-8 grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label={`${topic.name} subtopics`}>
        {topic.subtopics.map((item) => (
          <button className="group rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" key={item} type="button" onClick={() => open(item)}>
            <Card className="h-full min-h-44 justify-center overflow-hidden border-primary/15 bg-gradient-to-br from-accent/80 via-card to-card shadow-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:border-primary/40 group-hover:shadow-[0_18px_45px_-24px_rgba(47,91,234,0.65)]">
              <CardContent className="flex flex-col gap-6">
                <div className="flex items-start justify-between">
                  <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground"><BookOpen className="size-5" aria-hidden="true" /></span>
                  <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </div>
                <CardTitle className="text-lg font-medium leading-7 text-foreground/80">{item}</CardTitle>
              </CardContent>
            </Card>
          </button>
        ))}
      </section>

      <Dialog open={Boolean(subtopic)} onOpenChange={(openState) => { if (!openState && !creating) setSubtopic(undefined); }}>
        <DialogContent className="max-w-xl gap-0 overflow-hidden p-0 sm:rounded-2xl">
          <DialogHeader className="border-b border-border px-6 py-5 pr-14 text-left">
            <div className="mb-3 flex items-center gap-2"><Badge variant="secondary">Topic test</Badge><span className="text-xs text-muted-foreground">5 questions · increasing difficulty</span></div>
            <DialogTitle className="text-xl leading-7 tracking-tight">{subtopic}</DialogTitle>
            <DialogDescription>Nyx will prepare a fresh set and evaluate both your answers and board work.</DialogDescription>
          </DialogHeader>

          <div className="p-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Choose a mode</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <ModeCard active={mode === "preparation"} icon={Brain} title="Preparation" description="Ask Nyx for help while you work." onClick={() => setMode("preparation")} />
              <ModeCard active={mode === "test"} icon={ShieldCheck} title="Test" description="Nyx stays off until you submit." onClick={() => setMode("test")} />
            </div>
            <div className="mt-5 flex items-start gap-3 rounded-xl bg-muted/70 p-4 text-sm leading-6 text-muted-foreground">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
              <p>The five problems start approachable and become more demanding. Your final report explains the grade, strengths, and mistakes task by task.</p>
            </div>
            {error && <p className="mt-4 text-sm text-destructive" role="alert">{error}</p>}
          </div>

          <footer className="flex items-center justify-between border-t border-border bg-muted/25 px-6 py-4">
            <span className="text-xs text-muted-foreground">Usually 20–35 minutes</span>
            <Button onClick={start} disabled={creating}>
              {creating ? <LoaderCircle className="animate-spin" /> : <ChevronRight />}
              {creating ? "Preparing…" : `Start ${mode}`}
            </Button>
          </footer>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ModeCard({ active, icon: Icon, title, description, onClick }: { active: boolean; icon: typeof Brain; title: string; description: string; onClick: () => void }) {
  return (
    <button className={`rounded-xl border p-4 text-left transition-colors ${active ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/60"}`} type="button" onClick={onClick} aria-pressed={active}>
      <Icon className={`size-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
      <strong className="mt-3 block text-sm">{title}</strong>
      <span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span>
    </button>
  );
}

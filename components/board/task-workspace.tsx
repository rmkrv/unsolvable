"use client";

import { Check, ClipboardList, FileText } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import type { TaskDescription } from "@/lib/domain/board/model";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const MAX_VISIBLE_TASKS = 20;

function cleanPrompt(value: string) {
  return value
    .replace(/^\s*(?:\d+|[a-z])[).:\-]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function taskPrompts(task: TaskDescription) {
  const text = task.text?.trim();
  if (!text) return ["Solve the problem in the attached task."];

  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const numbered: string[] = [];
  let current = "";

  for (const line of lines) {
    if (/^(?:\d+|[a-z])[).:\-]\s+/i.test(line)) {
      if (current) numbered.push(cleanPrompt(current));
      current = line;
    } else if (current) {
      current += ` ${line}`;
    }
  }
  if (current) numbered.push(cleanPrompt(current));

  if (numbered.length > 1) return numbered.filter(Boolean).slice(0, MAX_VISIBLE_TASKS);

  const compactLines = lines
    .map(cleanPrompt)
    .filter((line) => line.length >= 2 && line.length <= 360);
  const equationLike = compactLines.filter((line) => /[=?]|\b(?:solve|find|calculate|evaluate|prove|simplify)\b/i.test(line));
  if (equationLike.length > 1) return equationLike.slice(0, MAX_VISIBLE_TASKS);

  const paragraphs = text
    .split(/\n\s*\n/)
    .map(cleanPrompt)
    .filter(Boolean)
    .slice(0, MAX_VISIBLE_TASKS);
  return paragraphs.length > 1 ? paragraphs : [cleanPrompt(text).slice(0, 600)];
}

export function TaskWorkspace({
  task,
  open,
  onOpenChange,
  onSubmit,
}: {
  task?: TaskDescription;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (answers: string[]) => void | Promise<void>;
}) {
  const prompts = useMemo(() => task ? taskPrompts(task) : [], [task]);
  const [answers, setAnswers] = useState<string[]>(() => prompts.map(() => ""));
  const [submitting, setSubmitting] = useState(false);

  if (!task) return null;

  const answeredCount = answers.filter((answer) => answer.trim()).length;
  const allAnswered = prompts.length > 0 && answeredCount === prompts.length;
  const originalImage = !task.text ? (task.images?.[0] ?? task.image) : undefined;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!allAnswered || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(answers.map((answer) => answer.trim()));
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(760px,calc(100dvh-2rem))] max-w-3xl gap-0 overflow-hidden border-border/80 bg-[#fffefa] p-0 shadow-2xl sm:rounded-2xl">
        <DialogHeader className="border-b border-border/70 px-6 py-5 pr-14 text-left sm:px-8">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <ClipboardList size={19} strokeWidth={1.9} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <DialogTitle className="text-xl tracking-[-0.025em]">Tasks</DialogTitle>
                <span className="text-xs font-medium text-muted-foreground">
                  {answeredCount} of {prompts.length} answered
                </span>
              </div>
              <DialogDescription className="mt-1 flex min-w-0 items-center gap-1.5">
                <FileText className="size-3.5 shrink-0" />
                <span className="truncate">{task.sourceName}</span>
              </DialogDescription>
            </div>
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${prompts.length ? (answeredCount / prompts.length) * 100 : 0}%` }}
            />
          </div>
        </DialogHeader>

        <form className="grid min-h-0 grid-rows-[1fr_auto]" onSubmit={submit}>
          <div className="min-h-0 overflow-y-auto px-6 py-5 sm:px-8 sm:py-6">
            <div className="grid gap-4">
              {prompts.map((prompt, index) => (
                <section className="grid gap-3 rounded-xl border border-border/75 bg-background/70 p-4 sm:grid-cols-[2rem_minmax(0,1fr)]" key={`${index}-${prompt.slice(0, 32)}`}>
                  <span className="grid size-8 place-items-center rounded-lg bg-muted text-sm font-semibold text-muted-foreground" aria-hidden="true">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{prompt}</p>
                    {index === 0 && originalImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        className="mt-3 max-h-72 w-full rounded-lg border border-border bg-white object-contain"
                        src={originalImage.dataUrl}
                        alt={`Original task from ${task.sourceName}`}
                      />
                    )}
                    <label className="mt-3 block">
                      <span className="sr-only">Answer for task {index + 1}</span>
                      <Input
                        className="h-11 bg-background text-sm shadow-none"
                        value={answers[index] ?? ""}
                        onChange={(event) => setAnswers((previous) => previous.map((answer, answerIndex) => answerIndex === index ? event.target.value : answer))}
                        placeholder="Type your answer"
                        autoComplete="off"
                      />
                    </label>
                  </div>
                </section>
              ))}
            </div>
          </div>

          <footer className="flex items-center justify-between gap-4 border-t border-border/70 bg-muted/25 px-6 py-4 sm:px-8">
            <p className="hidden text-xs text-muted-foreground sm:block">
              Your answers will be sent to Nyx for checking.
            </p>
            <Button className="ml-auto min-w-32 gap-2" type="submit" disabled={!allAnswered || submitting}>
              <Check size={16} />
              {submitting ? "Submitting…" : "Submit answers"}
            </Button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}

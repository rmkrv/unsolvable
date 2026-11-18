"use client";

import Link from "next/link";
import { BarChart3, LoaderCircle, ShieldCheck } from "lucide-react";
import { TopicTestAnalysisDetails } from "@/components/analysis/topic-test-analysis-details";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { TopicTestSession } from "@/lib/domain/topic-test";

export function TopicTestStatus({ session, open, onOpenChange, onRetry }: { session?: TopicTestSession; open: boolean; onOpenChange: (open: boolean) => void; onRetry: () => void }) {
  if (!session) return null;
  const waiting = session.status === "generating" || session.status === "analyzing";
  const analysis = session.analysis;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!waiting) onOpenChange(next); }}>
      <DialogContent className="max-h-[88vh] max-w-2xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:rounded-2xl" showCloseButton={!waiting}>
        {waiting ? (
          <div className="flex flex-col items-center px-8 py-12 text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"><LoaderCircle className="animate-spin" /></span>
            <DialogTitle className="mt-5 text-xl">{session.status === "generating" ? "Nyx is preparing your test" : "Nyx is analyzing your work"}</DialogTitle>
            <DialogDescription className="mt-2 max-w-sm leading-6">{session.status === "generating" ? "Creating five original problems that increase in complexity." : "Reviewing every submitted answer and the complete board. This can take a moment."}</DialogDescription>
            <div className="mt-6 h-1.5 w-48 overflow-hidden rounded-full bg-muted"><div className="h-full w-2/3 animate-pulse rounded-full bg-primary" /></div>
          </div>
        ) : session.status === "error" ? (
          <div className="flex flex-col items-center px-8 py-10 text-center"><ShieldCheck className="size-8 text-destructive" /><DialogTitle className="mt-4">Nyx could not finish</DialogTitle><DialogDescription className="mt-2 max-w-sm leading-6">{session.error || "The response could not be read. Your board is safe."}</DialogDescription><Button className="mt-6" onClick={onRetry}>Try again</Button></div>
        ) : analysis ? (
          <>
            <DialogHeader className="border-b border-border px-6 py-5 pr-14 text-left">
              <div className="flex items-start gap-4"><span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary/10 text-3xl font-semibold text-primary">{analysis.grade}</span><div><DialogTitle className="text-xl">{analysis.score}/100</DialogTitle><DialogDescription className="mt-1">{analysis.gradeReason}</DialogDescription></div></div>
            </DialogHeader>
            <div className="scrollbar-hidden min-h-0 space-y-5 overflow-y-auto overscroll-contain p-6">
              <TopicTestAnalysisDetails analysis={analysis} />
            </div>
            <footer className="flex justify-end gap-2 border-t border-border bg-muted/25 px-6 py-4"><Button variant="outline" onClick={() => onOpenChange(false)}>Back to board</Button><Button asChild><Link href="/analysis"><BarChart3 />Open Analysis</Link></Button></footer>
          </>
        ) : (
          <div className="p-8 text-center"><ShieldCheck className="mx-auto text-primary" /><DialogTitle className="mt-4">Test ready</DialogTitle></div>
        )}
      </DialogContent>
    </Dialog>
  );
}

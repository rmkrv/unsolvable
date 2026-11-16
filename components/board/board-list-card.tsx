"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock3, LayoutGrid, LoaderCircle, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type BoardListCardProps = {
  boardId: string;
  title: string;
  subject: string | null;
  eventVersion: number;
  lastOpenedLabel: string;
};

export function BoardListCard({
  boardId,
  title,
  subject,
  eventVersion,
  lastOpenedLabel,
}: BoardListCardProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState("");

  async function deleteBoard() {
    if (deleting) return;
    setDeleting(true);
    setError("");
    try {
      const response = await fetch(`/api/student/boards/${encodeURIComponent(boardId)}?permanent=true`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => null) as
        | { deleted?: boolean; error?: string | { message?: string } }
        | null;
      const message = typeof payload?.error === "string" ? payload.error : payload?.error?.message;
      if (!response.ok || !payload?.deleted) throw new Error(message || "Could not delete this board.");
      setDeleted(true);
      setDialogOpen(false);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not delete this board.");
    } finally {
      setDeleting(false);
    }
  }

  if (deleted) return null;

  return (
    <Card className="group relative gap-0 overflow-hidden py-0 transition duration-200 hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-md">
      <Link
        href={`/boards/${encodeURIComponent(boardId)}`}
        className="block rounded-xl p-6 pr-16 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <div className="flex items-center justify-between gap-3">
          <LayoutGrid size={20} className="text-primary" />
          <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
            v{eventVersion}
          </Badge>
        </div>
        <h3 className="mt-5 truncate text-base font-semibold tracking-[-0.01em]">{title}</h3>
        <p className="mt-1 truncate text-sm text-muted-foreground">{subject || "Mathematics"}</p>
        <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><Clock3 size={14} />{lastOpenedLabel}</span>
          <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
        </div>
      </Link>

      <AlertDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (deleting) return;
          setDialogOpen(open);
          if (!open) setError("");
        }}
      >
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="absolute right-4 top-4 z-10 text-muted-foreground opacity-70 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label={`Delete ${title}`}
                >
                  <Trash2 />
                </Button>
              </AlertDialogTrigger>
            </TooltipTrigger>
            <TooltipContent side="top">Delete board</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the board and its full working history. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <Button type="button" variant="destructive" onClick={() => void deleteBoard()} disabled={deleting}>
              {deleting ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

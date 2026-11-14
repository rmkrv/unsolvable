"use client";

import { FileUp, FileText, History, Image as ImageIcon, LayoutGrid, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type ActionId = "upload" | "new-board" | "open-previous" | "open-board" | "export-png" | "export";
type ActionDefinition = {
  id: ActionId;
  label: string;
  description: string;
  keywords: string;
  icon: typeof Search;
};

const ACTION_DEFINITIONS: ActionDefinition[] = [
  { id: "upload", label: "Give task to Nyx", description: "PDF, DOCX, TXT, or image", keywords: "file document problem task image context", icon: FileUp },
  { id: "new-board", label: "New board", description: "Start another clean practice board", keywords: "create blank fresh", icon: Plus },
  { id: "open-previous", label: "Open previous", description: "Return to your most recent earlier board", keywords: "recent last continue history", icon: History },
  { id: "open-board", label: "Open board", description: "Browse all saved boards", keywords: "library choose existing browse", icon: LayoutGrid },
  { id: "export-png", label: "Export to PNG", description: "Download the active board page as an image", keywords: "image picture download save", icon: ImageIcon },
  { id: "export", label: "Export to PDF", description: "Print every board page to PDF", keywords: "download save print", icon: FileText },
];

function filteredActions(query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return ACTION_DEFINITIONS;
  return ACTION_DEFINITIONS.filter((action) => `${action.label} ${action.description} ${action.keywords}`.toLowerCase().includes(needle));
}

export function PracticeActionSearch({
  onGiveTaskToNyx,
  onCreateBoard,
  onOpenPrevious,
  onOpenBoard,
  onExportPng,
  onExportPdf,
}: {
  onGiveTaskToNyx: (file: File) => void | Promise<void>;
  onCreateBoard: () => void | Promise<void>;
  onOpenPrevious: () => void | Promise<void>;
  onOpenBoard: () => void | Promise<void>;
  onExportPng: () => void | Promise<void>;
  onExportPdf: () => void | Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<ActionId | null>(null);
  const [selectedId, setSelectedId] = useState<ActionId>(ACTION_DEFINITIONS[0].id);
  const actions = useMemo(() => filteredActions(query), [query]);

  function open() {
    setQuery("");
    setSelectedId(ACTION_DEFINITIONS[0].id);
    setIsOpen(true);
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && event.code === "Slash") {
        event.preventDefault();
        open();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function run(id: ActionId) {
    if (busy) return;
    if (id === "upload") {
      setIsOpen(false);
      fileInputRef.current?.click();
      return;
    }
    setBusy(id);
    try {
      if (id === "new-board") await onCreateBoard();
      else if (id === "open-previous") await onOpenPrevious();
      else if (id === "open-board") await onOpenBoard();
      else if (id === "export-png") await onExportPng();
      else await onExportPdf();
      setIsOpen(false);
    } finally {
      setBusy(null);
    }
  }

  function moveSelection(distance: number) {
    if (!actions.length) return;
    const current = Math.max(0, actions.findIndex((action) => action.id === selectedId));
    const next = Math.max(0, Math.min(actions.length - 1, current + distance));
    setSelectedId(actions[next].id);
  }

  return (
    <>
      <Button className="header-nav-control practice-search-trigger" variant="ghost" size="sm" type="button" onClick={open} aria-label="Search practice actions" aria-keyshortcuts="Alt+/">
        <Search size={15} />
      </Button>
      <input
        ref={fileInputRef}
        className="sr-only"
        type="file"
        accept=".pdf,.docx,.txt,image/*,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void onGiveTaskToNyx(file);
        }}
      />

      <Dialog open={isOpen} onOpenChange={(openState) => { setIsOpen(openState); if (!openState) setQuery(""); }}>
        <DialogContent className="max-w-xl gap-0 overflow-hidden p-0" showCloseButton={false}>
          <DialogTitle className="sr-only">Practice actions</DialogTitle>
          <Command shouldFilter={false} value={selectedId} onValueChange={(value) => setSelectedId(value as ActionId)}>
            <CommandInput
              value={query}
              onValueChange={(nextQuery) => {
                setQuery(nextQuery);
                const nextActions = filteredActions(nextQuery);
                if (nextActions[0]) setSelectedId(nextActions[0].id);
              }}
              onKeyDown={(event) => {
                if (event.key === "PageDown") {
                  event.preventDefault();
                  moveSelection(5);
                } else if (event.key === "PageUp") {
                  event.preventDefault();
                  moveSelection(-5);
                } else if (event.key === "Home") {
                  event.preventDefault();
                  if (actions[0]) setSelectedId(actions[0].id);
                } else if (event.key === "End") {
                  event.preventDefault();
                  if (actions.at(-1)) setSelectedId(actions.at(-1)!.id);
                }
              }}
              placeholder="Search practice actions…"
              aria-label="Search practice actions"
            />
            <CommandList className="max-h-96 p-2">
              <CommandEmpty>No matching action</CommandEmpty>
              <CommandGroup className="p-0">
                {actions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <CommandItem
                      key={action.id}
                      value={action.id}
                      disabled={Boolean(busy)}
                      className="grid grid-cols-[36px_1fr] gap-x-3 rounded-md px-3 py-3 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                      onSelect={() => void run(action.id)}
                    >
                      <span className="row-span-2 grid size-9 place-items-center rounded-md bg-muted text-muted-foreground"><Icon size={16} /></span>
                      <strong className="font-medium text-foreground">{action.label}</strong>
                      <span className="text-xs text-muted-foreground">{busy === action.id ? "Working…" : action.description}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}

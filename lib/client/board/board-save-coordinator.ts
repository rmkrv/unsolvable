import type {
  BoardGateway,
  BoardSaveDraft,
  BoardSaveResult,
} from "./board-gateway";

export type BoardSaveKind = "autosave" | "explicit";
export type BoardSavePhase = "loading" | "ready" | "saving" | "conflict" | "stopped";

type Waiter = {
  resolve: (result: BoardSaveResult) => void;
  reject: (error: unknown) => void;
};

type SaveJob = {
  draft: BoardSaveDraft;
  kind: BoardSaveKind;
  waiters: Waiter[];
};

export class BoardSaveNotReadyError extends Error {
  constructor() {
    super("The shared board is still initializing.");
    this.name = "BoardSaveNotReadyError";
  }
}

function isConflict(error: unknown) {
  return typeof error === "object" && error !== null && "status" in error && error.status === 409;
}

/**
 * Serializes full-document board writes behind one optimistic-concurrency version.
 *
 * Routine autosaves are last-write-wins only while they are still queued locally.
 * Explicit saves retain their own queue position so snapshots, requests, and title
 * changes are never silently coalesced away. Server conflicts pause the queue until
 * the caller has loaded the authoritative document and calls rebase().
 */
export class BoardSaveCoordinator {
  private readonly gateway: BoardGateway;
  private phase: BoardSavePhase = "loading";
  private version = 0;
  private queue: SaveJob[] = [];
  private draining = false;
  private generation = 0;
  private activeJob: SaveJob | null = null;

  constructor(gateway: BoardGateway) {
    this.gateway = gateway;
  }

  getPhase() {
    return this.phase;
  }

  getVersion() {
    return this.version;
  }

  start(version: number) {
    this.generation += 1;
    this.version = version;
    this.phase = "ready";
    void this.drain();
  }

  rebase(version: number) {
    this.version = Math.max(this.version, version);
    if (this.phase === "conflict" || this.phase === "loading") this.phase = "ready";
    void this.drain();
  }

  stop() {
    this.generation += 1;
    this.phase = "stopped";
    const error = new BoardSaveNotReadyError();
    if (this.activeJob) {
      for (const waiter of this.activeJob.waiters) waiter.reject(error);
      this.activeJob = null;
    }
    for (const job of this.queue.splice(0)) {
      for (const waiter of job.waiters) waiter.reject(error);
    }
  }

  enqueue(draft: BoardSaveDraft, kind: BoardSaveKind = "autosave"): Promise<BoardSaveResult> {
    if (this.phase === "loading" || this.phase === "stopped") {
      return Promise.reject(new BoardSaveNotReadyError());
    }
    if (this.phase === "conflict") {
      return Promise.reject(new Error("Board changed elsewhere. Waiting for the latest version."));
    }

    return new Promise<BoardSaveResult>((resolve, reject) => {
      const waiter = { resolve, reject };
      const tail = this.queue.at(-1);
      if (kind === "autosave" && tail?.kind === "autosave") {
        tail.draft = draft;
        tail.waiters.push(waiter);
      } else {
        this.queue.push({ draft, kind, waiters: [waiter] });
      }
      void this.drain();
    });
  }

  private async drain() {
    if (this.draining || this.phase !== "ready" || this.queue.length === 0) return;
    this.draining = true;
    const generation = this.generation;
    try {
      while (generation === this.generation && this.phase === "ready" && this.queue.length > 0) {
        const job = this.queue.shift()!;
        this.activeJob = job;
        this.phase = "saving";
        try {
          const result = await this.gateway.save({
            ...job.draft,
            expectedVersion: this.version,
          });
          if (generation !== this.generation) break;
          this.version = result.eventVersion;
          this.phase = "ready";
          for (const waiter of job.waiters) waiter.resolve(result);
        } catch (error) {
          if (generation !== this.generation) break;
          this.phase = isConflict(error) ? "conflict" : "ready";
          for (const waiter of job.waiters) waiter.reject(error);
          if (this.phase === "conflict") {
            const queued = this.queue.splice(0);
            for (const pending of queued) {
              for (const waiter of pending.waiters) waiter.reject(error);
            }
          }
          break;
        } finally {
          if (this.activeJob === job) this.activeJob = null;
        }
      }
    } finally {
      this.draining = false;
      if (this.phase === "ready" && this.queue.length > 0) void this.drain();
    }
  }
}

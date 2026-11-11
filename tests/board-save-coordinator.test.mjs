import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import typescript from "typescript";

async function coordinatorModule() {
  const source = readFileSync(join(process.cwd(), "lib/client/board/board-save-coordinator.ts"), "utf8");
  const output = typescript.transpileModule(source, {
    compilerOptions: {
      module: typescript.ModuleKind.ESNext,
      target: typescript.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

function document(label) {
  return {
    boardId: "board-1",
    pages: [{ id: "page-1", name: label, strokes: [] }],
    activePageId: "page-1",
    viewport: { x: 0, y: 0, zoom: 1 },
    hintLevel: 2,
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test("save coordinator gates writes until hydration", async () => {
  const { BoardSaveCoordinator, BoardSaveNotReadyError } = await coordinatorModule();
  const coordinator = new BoardSaveCoordinator({ save: async () => ({ eventVersion: 1, updatedAt: 1 }) });
  await assert.rejects(coordinator.enqueue({ document: document("early") }), BoardSaveNotReadyError);
});

test("save coordinator serializes writes and coalesces queued autosaves", async () => {
  const { BoardSaveCoordinator } = await coordinatorModule();
  const first = deferred();
  const requests = [];
  const gateway = {
    async save(request) {
      requests.push(request);
      if (requests.length === 1) return first.promise;
      return { eventVersion: request.expectedVersion + 1, updatedAt: requests.length };
    },
  };
  const coordinator = new BoardSaveCoordinator(gateway);
  coordinator.start(4);

  const initial = coordinator.enqueue({ document: document("first") });
  const second = coordinator.enqueue({ document: document("second") });
  const latest = coordinator.enqueue({ document: document("latest") });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].expectedVersion, 4);

  first.resolve({ eventVersion: 5, updatedAt: 1 });
  await initial;
  const [secondResult, latestResult] = await Promise.all([second, latest]);

  assert.equal(requests.length, 2);
  assert.equal(requests[1].document.pages[0].name, "latest");
  assert.equal(requests[1].expectedVersion, 5);
  assert.deepEqual(secondResult, latestResult);
  assert.equal(coordinator.getVersion(), 6);
});

test("explicit saves retain queue order", async () => {
  const { BoardSaveCoordinator } = await coordinatorModule();
  const first = deferred();
  const requests = [];
  const gateway = {
    async save(request) {
      requests.push(request);
      if (requests.length === 1) return first.promise;
      return { eventVersion: request.expectedVersion + 1, updatedAt: requests.length };
    },
  };
  const coordinator = new BoardSaveCoordinator(gateway);
  coordinator.start(1);
  const saving = coordinator.enqueue({ document: document("initial") });
  const explicit = coordinator.enqueue({ document: document("request"), snapshotDataUrl: "data:image/png;base64,AA==" }, "explicit");
  const autosave = coordinator.enqueue({ document: document("after") });
  first.resolve({ eventVersion: 2, updatedAt: 1 });
  await Promise.all([saving, explicit, autosave]);

  assert.deepEqual(requests.map((request) => request.document.pages[0].name), ["initial", "request", "after"]);
  assert.deepEqual(requests.map((request) => request.expectedVersion), [1, 2, 3]);
});

test("conflicts pause writes until the authoritative version is rebased", async () => {
  const { BoardSaveCoordinator } = await coordinatorModule();
  const requests = [];
  const gateway = {
    async save(request) {
      requests.push(request);
      if (requests.length === 1) throw Object.assign(new Error("Conflict"), { status: 409 });
      return { eventVersion: request.expectedVersion + 1, updatedAt: 2 };
    },
  };
  const coordinator = new BoardSaveCoordinator(gateway);
  coordinator.start(7);

  await assert.rejects(coordinator.enqueue({ document: document("conflict") }), /Conflict/);
  assert.equal(coordinator.getPhase(), "conflict");
  await assert.rejects(coordinator.enqueue({ document: document("blocked") }), /changed elsewhere/);

  coordinator.rebase(9);
  await coordinator.enqueue({ document: document("recovered") });
  assert.equal(requests[1].expectedVersion, 9);
  assert.equal(coordinator.getVersion(), 10);
});

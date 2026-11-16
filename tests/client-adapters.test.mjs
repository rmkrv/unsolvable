import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import typescript from "typescript";

async function importTypeScript(relativePath) {
  const source = readFileSync(join(process.cwd(), relativePath), "utf8");
  const output = typescript.transpileModule(source, {
    compilerOptions: {
      module: typescript.ModuleKind.ESNext,
      target: typescript.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

test("HTTP board gateway owns board route serialization", async () => {
  const { createHttpBoardGateway } = await importTypeScript("lib/client/board/board-gateway.ts");
  const requests = [];
  const fetcher = async (input, init) => {
    requests.push({ input, init });
    return Response.json(
      init?.method === "PUT"
        ? { eventVersion: 4, updatedAt: 123 }
        : input.includes("/actions?") ? { actions: [] } : { board: null },
    );
  };
  const gateway = createHttpBoardGateway(fetcher);

  assert.deepEqual(await gateway.read("board-1", 9), { board: null, actions: [] });
  assert.equal(requests[0].input, "/api/student/boards/board-1");
  assert.equal(requests[1].input, "/api/student/boards/board-1/actions?boardId=board-1&after=9");

  const document = {
    boardId: "board-1",
    pages: [{ id: "page-1", name: "Page 1", strokes: [] }],
    activePageId: "page-1",
    viewport: { x: 0, y: 0, zoom: 1 },
    hintLevel: 2,
    autoObserve: false,
  };
  assert.deepEqual(await gateway.save({
    document,
    snapshotDataUrl: "data:image/png;base64,AA==",
    expectedVersion: 0,
    title: "Renamed board",
  }), { eventVersion: 4, updatedAt: 123 });
  const body = JSON.parse(requests[2].init.body);
  assert.equal(requests[2].input, "/api/student/boards/board-1");
  assert.equal("boardId" in body, false);
  assert.deepEqual(body.state, document);
  assert.equal(body.expectedVersion, 0);
  assert.equal(body.title, "Renamed board");

  requests.length = 0;
  const deletionGateway = createHttpBoardGateway(async (input, init) => {
    requests.push({ input, init });
    return Response.json({ deleted: true });
  });
  assert.equal(await deletionGateway.deleteIfEmpty("board-1", { keepalive: true }), true);
  assert.equal(requests[0].input, "/api/student/boards/board-1?ifEmpty=true");
  assert.equal(requests[0].init.method, "DELETE");
  assert.equal(requests[0].init.keepalive, true);
});

test("HTTP board gateway preserves API status and error code", async () => {
  const { BoardGatewayError, createHttpBoardGateway } = await importTypeScript("lib/client/board/board-gateway.ts");
  const gateway = createHttpBoardGateway(async () => Response.json(
    { error: { code: "version_conflict", message: "Board changed elsewhere." } },
    { status: 409 },
  ));

  await assert.rejects(
    gateway.save({
      document: { boardId: "board-1", pages: [], activePageId: "page-1", viewport: { x: 0, y: 0, zoom: 1 }, hintLevel: 2, autoObserve: false },
      expectedVersion: 2,
    }),
    (error) => error instanceof BoardGatewayError && error.status === 409 && error.code === "version_conflict",
  );
});

test("HTTP board gateway can poll actions without downloading the board", async () => {
  const { createHttpBoardGateway } = await importTypeScript("lib/client/board/board-gateway.ts");
  const requests = [];
  const gateway = createHttpBoardGateway(async (input) => {
    requests.push(input);
    return Response.json({ actions: [{ id: 12, value: { type: "speak", speech: "Ready" } }] });
  });

  const result = await gateway.read("board-1", 11, { includeBoard: false });

  assert.equal(result.board, null);
  assert.equal(result.actions.length, 1);
  assert.deepEqual(requests, ["/api/student/boards/board-1/actions?boardId=board-1&after=11"]);
});

test("HTTP board gateway lists recent boards for practice navigation", async () => {
  const { createHttpBoardGateway } = await importTypeScript("lib/client/board/board-gateway.ts");
  const requests = [];
  const board = { boardId: "board-2", title: "Previous", subject: null, eventVersion: 3, lastOpenedAt: 20, updatedAt: 10 };
  const gateway = createHttpBoardGateway(async (input, init) => {
    requests.push({ input, init });
    return Response.json({ boards: [board] });
  });

  assert.deepEqual(await gateway.list(50), [board]);
  assert.equal(requests[0].input, "/api/student/boards?limit=50");
  assert.equal(requests[0].init.cache, "no-store");
});

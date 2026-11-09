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
  };
  assert.deepEqual(await gateway.save(document, "data:image/png;base64,AA==", 3, "Renamed board"), { eventVersion: 4, updatedAt: 123 });
  const body = JSON.parse(requests[2].init.body);
  assert.equal(requests[2].input, "/api/student/boards/board-1");
  assert.equal("boardId" in body, false);
  assert.deepEqual(body.state, document);
  assert.equal(body.expectedVersion, 3);
  assert.equal(body.title, "Renamed board");
});

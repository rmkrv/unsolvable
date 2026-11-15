import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import test from "node:test";
import { CodexAppServerClient } from "../scripts/codex-app-server-client.mjs";

function createFakeProcess(onMessage) {
  const child = new EventEmitter();
  child.stdin = new PassThrough();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = () => child.emit("exit", 0);
  let buffer = "";
  child.stdin.on("data", (chunk) => {
    buffer += chunk.toString();
    for (let end = buffer.indexOf("\n"); end !== -1; end = buffer.indexOf("\n")) {
      const line = buffer.slice(0, end).trim();
      buffer = buffer.slice(end + 1);
      if (line) onMessage(JSON.parse(line), child);
    }
  });
  return child;
}

test("app-server client initializes once and reuses the process for requests", async () => {
  const sent = [];
  const child = createFakeProcess((message, process) => {
    sent.push(message);
    if (message.method === "initialize") {
      process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { userAgent: "test" } })}\n`);
    }
    if (message.method === "thread/start") {
      process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { thread: { id: "thread-1" } } })}\n`);
    }
  });
  let spawnCount = 0;
  const client = new CodexAppServerClient({
    binary: "codex",
    args: ["-c", "model=fast"],
    spawnProcess(binary, args) {
      spawnCount += 1;
      assert.equal(binary, "codex");
      assert.deepEqual(args, ["app-server", "--listen", "stdio://", "-c", "model=fast"]);
      return child;
    },
  });

  await client.start();
  const result = await client.request("thread/start", { ephemeral: true });

  assert.equal(spawnCount, 1);
  assert.equal(result.thread.id, "thread-1");
  assert.deepEqual(sent.map(({ method }) => method), ["initialize", "initialized", "thread/start"]);
  client.close();
});

test("app-server client dispatches notifications", async () => {
  const child = createFakeProcess((message, process) => {
    if (message.method === "initialize") {
      process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: message.id, result: {} })}\n`);
    }
  });
  const client = new CodexAppServerClient({ binary: "codex", spawnProcess: () => child });
  await client.start();

  const received = onceNotification(client);
  child.stdout.write(`${JSON.stringify({
    jsonrpc: "2.0",
    method: "item/completed",
    params: { threadId: "thread-1", item: { type: "agentMessage", text: "Done" } },
  })}\n`);

  assert.deepEqual(await received, [
    "item/completed",
    { threadId: "thread-1", item: { type: "agentMessage", text: "Done" } },
  ]);
  client.close();
});

function onceNotification(client) {
  return new Promise((resolve) => {
    const stop = client.onNotification((method, params) => {
      stop();
      resolve([method, params]);
    });
  });
}

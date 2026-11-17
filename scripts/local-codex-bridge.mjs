import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import os from "node:os";
import { CodexAppServerClient } from "./codex-app-server-client.mjs";
import { HINT_POLICY_PROMPT } from "../bridge/hint-policy.mjs";

const ALLOWED_ORIGINS = new Set(["http://127.0.0.1:5173", "http://localhost:5173"]);
const MAX_BODY_BYTES = 32_768;
const TURN_TIMEOUT_MS = 90_000;

const NYX_INSTRUCTIONS = [
  "You are Nyx, an engineering whiteboard tutor. Use the vector MCP tools to inspect and update the student's board.",
  "If observe_board reports a task description that is new to this conversation, call unsolvable.read_task_description once, retain its contents as the task context, and do not mention or summarize the upload unless the student asks.",
  "Understand requests in any language, but respond only in English. Every spoken field (speech or narration) and your final reply must be English, even when the student uses Russian.",
  "Call unsolvable.observe_board exactly once at the start of the turn. Never call it twice in one turn, including after a board write: write-tool results already contain the updated event version and board summary. Read the attached board image carefully before judging legibility. Do not reject the whole step as unclear when a reasonable transcription is visible; name only the specific ambiguous symbol when genuine ambiguity remains.",
  "For simple numeric arithmetic, reason directly and do not call verify_arithmetic_equation: board_write_equation validates a proposed correction server-side. For an explicit check or correction involving a wrong numeric equation, mark only the mistaken stroke with unsolvable.board_feedback, then use unsolvable.board_write_equation to handwrite the valid equation in nearby free space. For example, if the student wrote 1 + 2 = 4, underline the 4 and write 1 + 2 = 3. Use verify_math_step at most once only for a confidently transcribed, nontrivial algebra transition.",
  `Apply the selected help level to every tutoring response unless the student explicitly asks for a different amount of help:\n${HINT_POLICY_PROMPT}`,
  "When writing math, use ordinary lowercase variable letters and plain expressions such as x^3/3. Unsolvable renders ^ as a raised power, / as a fraction, and _ as a subscript. Do not send LaTeX commands or spell out punctuation. For a definite integral, evaluate the bounds; do not equate it to an indefinite antiderivative with +C.",
  "Use board_feedback, board_draw, board_erase, and board_say to teach on the board. For a diagram outside the fixed templates, use board_write_text for short labels and board_draw_arrow for arrows at observed board coordinates. These are editable pen strokes, and arrows do not attach to shapes.",
  "Use the fewest board actions that satisfy the request. Do not claim the board lacks text or arrows: check the available tools. If a requested layout still cannot be made with them, explain the specific missing operation and offer a usable fallback.",
  "Send at most one spoken message per turn. If you use multiple board tools, put speech or narration in only one tool call and leave the other spoken fields empty. Do not call board_say after a tool that already speaks.",
  "Do not edit source files or run shell commands. Give a short final response for the student's status display.",
].join("\n");

function createTurnPrompt(boardId, trigger, message) {
  return [
    `Board ID: ${boardId}`,
    `Request trigger: ${trigger}`,
    `Student request: ${message}`,
  ].join("\n");
}

export function findCodexBinary(env = process.env) {
  if (env.CODEX_BIN && existsSync(env.CODEX_BIN)) return env.CODEX_BIN;
  const executable = process.platform === "win32" ? "codex.exe" : "codex";
  for (const directory of (env.PATH ?? "").split(process.platform === "win32" ? ";" : ":")) {
    const candidate = join(directory, executable);
    if (directory && existsSync(candidate)) return candidate;
  }
  if (process.platform === "win32" && env.LOCALAPPDATA) {
    const base = join(env.LOCALAPPDATA, "OpenAI", "Codex", "bin");
    if (existsSync(base)) {
      for (const directory of readdirSync(base).reverse()) {
        const candidate = join(base, directory, "codex.exe");
        if (existsSync(candidate)) return candidate;
      }
    }
  }
  return null;
}

function sendJson(response, status, value, origin) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...(origin ? { "access-control-allow-origin": origin, vary: "Origin" } : {}),
  });
  response.end(JSON.stringify(value));
}

function runCodex(binary, args, env, onEvent) {
  return new Promise((resolve) => {
    let settled = false;
    let output = "";
    let errors = "";
    const child = spawn(binary, args, { cwd: process.cwd(), env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      resolve({ ...result, child });
    };
    const deadline = setTimeout(() => {
      child.kill();
      finish({ code: -1, stderr: "Nyx timed out. Your work is saved; retry the analysis." });
    }, TURN_TIMEOUT_MS);
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
      for (let end = output.indexOf("\n"); end !== -1; end = output.indexOf("\n")) {
        const line = output.slice(0, end);
        output = output.slice(end + 1);
        try { onEvent(JSON.parse(line)); } catch { /* Ignore non-JSON CLI output. */ }
      }
    });
    child.stderr.on("data", (chunk) => { errors = (errors + chunk.toString()).slice(-4000); });
    child.on("error", (error) => finish({ code: -1, error: error.message, stderr: errors }));
    child.on("exit", (code) => finish({ code, stderr: errors }));
    onEvent({ type: "bridge.child", child });
  });
}

export async function startLocalCodexBridge({ siteUrl = "http://127.0.0.1:5173" } = {}) {
  const binary = findCodexBinary();
  const env = { ...process.env, CODEX_HOME: process.env.CODEX_HOME || join(os.homedir(), ".codex") };
  const nyxModel = process.env.NYX_MODEL?.trim() || "gpt-5.6-sol";
  const nyxReasoningEffort = process.env.NYX_REASONING_EFFORT?.trim() || "low";
  const requestedBridgeMode = process.env.NYX_BRIDGE_MODE?.trim() || "app-server";
  const sessions = new Map();
  const running = new Map();
  let appServer = null;
  let appServerStartupError = null;
  let statusCache = null;
  let statusAt = 0;

  async function getAppServerThread(boardId) {
    const previous = sessions.get(boardId);
    if (previous?.mode === "app-server") return previous.threadId;
    const result = await appServer.request("thread/start", {
      model: nyxModel,
      cwd: process.cwd(),
      approvalPolicy: "never",
      sandbox: "read-only",
      developerInstructions: NYX_INSTRUCTIONS,
      ephemeral: true,
    }, 15_000);
    const threadId = result?.thread?.id;
    if (!threadId) throw new Error("Codex app-server did not create a thread.");
    sessions.set(boardId, { mode: "app-server", threadId });
    return threadId;
  }

  async function runAppServerTurn(boardId, message, trigger) {
    const active = { mode: "app-server", threadId: null, turnId: null, cancelled: false };
    running.set(boardId, active);
    let threadId;
    try {
      threadId = await getAppServerThread(boardId);
      active.threadId = threadId;
      if (active.cancelled) throw new Error("Codex turn stopped.");
    } catch (error) {
      if (running.get(boardId) === active) running.delete(boardId);
      throw error;
    }
    let turnId = null;
    let reply = "";
    let earlyCompletion = null;
    let finishTurn;
    let failTurn;
    const completed = new Promise((resolve, reject) => {
      finishTurn = resolve;
      failTurn = reject;
    });
    const stopListening = appServer.onNotification((method, params) => {
      if (params.threadId !== threadId) return;
      if (method === "item/completed" && params.item?.type === "agentMessage") {
        reply = params.item.text || reply;
      }
      if (method !== "turn/completed") return;
      if (!turnId) {
        earlyCompletion = params;
        return;
      }
      if (params.turn?.id === turnId) finishTurn(params.turn);
    });
    const timeout = setTimeout(() => failTurn(new Error("Nyx timed out while completing the turn. Your work is saved; retry the analysis.")), TURN_TIMEOUT_MS);
    // Attach a handler immediately, including while turn/start is pending.
    void completed.catch(() => undefined);
    try {
      const result = await appServer.request("turn/start", {
        threadId,
        input: [{ type: "text", text: createTurnPrompt(boardId, trigger, message) }],
        model: nyxModel,
        effort: nyxReasoningEffort,
      }, 15_000);
      turnId = result?.turn?.id;
      if (!turnId) throw new Error("Codex app-server did not start a turn.");
      active.turnId = turnId;
      if (active.cancelled) {
        await appServer.request("turn/interrupt", { threadId, turnId });
        throw new Error("Codex turn stopped.");
      }
      if (earlyCompletion?.turn?.id === turnId) finishTurn(earlyCompletion.turn);
      const turn = await completed;
      if (active.cancelled) throw new Error("Codex turn stopped.");
      if (turn?.status !== "completed") {
        throw new Error(turn?.error?.message || `Codex turn ended with status ${turn?.status || "unknown"}.`);
      }
      return { reply, threadId };
    } catch (error) {
      if (turnId) {
        await appServer.request("turn/interrupt", { threadId, turnId }, 5_000).catch(() => undefined);
      }
      sessions.delete(boardId);
      throw error;
    } finally {
      clearTimeout(timeout);
      stopListening();
      if (running.get(boardId) === active) running.delete(boardId);
    }
  }

  if (binary && requestedBridgeMode === "app-server") {
    appServer = new CodexAppServerClient({
      binary,
      env,
      args: [
        "-c", `model=${JSON.stringify(nyxModel)}`,
        "-c", `model_reasoning_effort=${JSON.stringify(nyxReasoningEffort)}`,
        "-c", `mcp_servers.unsolvable.url=${JSON.stringify(`${siteUrl}/mcp`)}`,
        "-c", "mcp_servers.unsolvable.enabled=true",
        "-c", 'mcp_servers.unsolvable.default_tools_approval_mode="approve"',
      ],
    });
    try {
      await appServer.start();
    } catch (error) {
      appServerStartupError = error;
      appServer.close();
      appServer = null;
    }
  }

  async function status() {
    if (appServer?.isRunning()) return { ready: true, label: `Nyx app-server ready (${nyxModel}, ${nyxReasoningEffort})` };
    if (Date.now() - statusAt < 10_000 && statusCache) return statusCache;
    if (!binary) return { ready: false, error: "Codex CLI is not installed. Install Codex, then sign in once." };
    let output = "";
    const result = await runCodex(binary, ["login", "status"], env, () => undefined);
    // `login status` writes its human-readable result to stdout, so check exit status.
    output = result.stderr || "";
    statusCache = result.code === 0
      ? {
          ready: true,
          label: appServerStartupError
            ? `Codex signed in; using exec fallback (${appServerStartupError.message})`
            : "Codex signed in on this computer",
        }
      : { ready: false, error: output.includes("home directory") ? "Codex home could not be found." : "Sign in to Codex on this computer once, then retry." };
    statusAt = Date.now();
    return statusCache;
  }

  const server = createServer(async (request, response) => {
    const origin = request.headers.origin;
    if (!origin || !ALLOWED_ORIGINS.has(origin)) return sendJson(response, 403, { error: "Origin not allowed" });
    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "access-control-allow-origin": origin || siteUrl,
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-allow-headers": "Content-Type",
      });
      return response.end();
    }
    const path = new URL(request.url, "http://127.0.0.1").pathname;
    if (path === "/status" && request.method === "GET") return sendJson(response, 200, await status(), origin);
    if (!["/turn", "/interrupt"].includes(path) || request.method !== "POST") return sendJson(response, 404, { error: "Not found" }, origin);

    let raw = "";
    try {
      for await (const chunk of request) {
        raw += chunk.toString();
        if (raw.length > MAX_BODY_BYTES) return sendJson(response, 413, { error: "Request too large" }, origin);
      }
      const body = JSON.parse(raw);
      const boardId = String(body.boardId || "").slice(0, 120);
      if (!boardId) return sendJson(response, 400, { error: "Board is not ready" }, origin);
      if (path === "/interrupt") {
        const active = running.get(boardId);
        if (active) {
          active.cancelled = true;
          if (active.mode === "app-server" && active.threadId && active.turnId) {
            await appServer.request("turn/interrupt", { threadId: active.threadId, turnId: active.turnId });
          } else if (active.mode === "exec") {
            active.child.kill();
          }
        }
        running.delete(boardId);
        return sendJson(response, 200, { ok: true }, origin);
      }
      const message = String(body.message || "").slice(0, 6000).trim();
      if (!message) return sendJson(response, 400, { error: "Message is empty" }, origin);
      const connection = await status();
      if (!connection.ready) return sendJson(response, 503, { error: connection.error }, origin);
      if (running.has(boardId)) return sendJson(response, 409, { error: "Codex is already working" }, origin);

      const trigger = String(body.trigger || "explicit").slice(0, 40);
      if (appServer?.isRunning()) {
        const result = await runAppServerTurn(boardId, message, trigger);
        return sendJson(response, 200, {
          ok: true,
          reply: result.reply.trim() || "Board updated.",
          threadId: result.threadId,
        }, origin);
      }

      const prompt = `${NYX_INSTRUCTIONS}\n${createTurnPrompt(boardId, trigger, message)}`;
      const config = [
        "--model", nyxModel,
        "-c", `model_reasoning_effort=${JSON.stringify(nyxReasoningEffort)}`,
        "-c", `mcp_servers.unsolvable.url=${JSON.stringify(`${siteUrl}/mcp`)}`,
        "-c", "mcp_servers.unsolvable.enabled=true",
        "-c", 'mcp_servers.unsolvable.default_tools_approval_mode="approve"',
      ];
      const savedSession = sessions.get(boardId);
      const previous = savedSession?.mode === "exec" ? savedSession.threadId : null;
      const args = previous
        ? ["exec", "resume", "--json", "--ignore-user-config", "--skip-git-repo-check", ...config, previous, prompt]
        : ["exec", "--json", "--ignore-user-config", "--sandbox", "read-only", "--skip-git-repo-check", ...config, prompt];
      let threadId = previous || null;
      let reply = "";
      let currentRun = null;
      const result = await runCodex(binary, args, env, (event) => {
        if (event.type === "bridge.child") {
          currentRun = { mode: "exec", child: event.child, cancelled: false };
          running.set(boardId, currentRun);
        }
        if (event.type === "thread.started" && event.thread_id) threadId = event.thread_id;
        if (event.type === "item.completed" && event.item?.type === "agent_message") reply = event.item.text || reply;
      });
      const active = running.get(boardId);
      if (active?.child === result.child) running.delete(boardId);
      if (currentRun?.cancelled) return sendJson(response, 409, { error: "Codex turn stopped." }, origin);
      if (threadId) sessions.set(boardId, { mode: "exec", threadId });
      if (result.code !== 0) {
        const error = /unable to open database file|failed to initialize in-process app-server client/i.test(result.stderr)
          ? "Codex could not write to its local home. Start Unsolvable from a normal terminal with access to your Codex profile."
          : result.stderr.trim().slice(-900) || "Codex could not complete this turn.";
        return sendJson(response, 502, { error }, origin);
      }
      return sendJson(response, 200, { ok: true, reply: reply.trim() || "Board updated.", threadId }, origin);
    } catch (error) {
      return sendJson(response, 500, { error: error instanceof Error ? error.message : "Local Codex bridge failed" }, origin);
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => {
      for (const active of running.values()) {
        if (active.mode === "exec") active.child.kill();
      }
      appServer?.close();
      server.close();
    },
  };
}

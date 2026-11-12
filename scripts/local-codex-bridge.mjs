import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import os from "node:os";

const ALLOWED_ORIGINS = new Set(["http://127.0.0.1:5173", "http://localhost:5173"]);
const MAX_BODY_BYTES = 4096;

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
      resolve({ ...result, child });
    };
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
  const sessions = new Map();
  const running = new Map();
  let statusCache = null;
  let statusAt = 0;

  async function status() {
    if (Date.now() - statusAt < 10_000 && statusCache) return statusCache;
    if (!binary) return { ready: false, error: "Codex CLI is not installed. Install Codex, then sign in once." };
    let output = "";
    const result = await runCodex(binary, ["login", "status"], env, () => undefined);
    // `login status` writes its human-readable result to stdout, so check exit status.
    output = result.stderr || "";
    statusCache = result.code === 0
      ? { ready: true, label: "Codex signed in on this computer" }
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
        if (active) { active.cancelled = true; active.child.kill(); }
        running.delete(boardId);
        return sendJson(response, 200, { ok: true }, origin);
      }
      const message = String(body.message || "").slice(0, 800).trim();
      if (!message) return sendJson(response, 400, { error: "Message is empty" }, origin);
      const connection = await status();
      if (!connection.ready) return sendJson(response, 503, { error: connection.error }, origin);
      if (running.has(boardId)) return sendJson(response, 409, { error: "Codex is already working" }, origin);

      const prompt = [
        "You are Nyx, an engineering whiteboard tutor. Use the vector MCP tools to inspect and update the student's board.",
        "If observe_board reports a task description that is new to this conversation, call unsolvable.read_task_description once, retain its contents as the task context, and do not mention or summarize the upload unless the student asks.",
        "Understand requests in any language, but respond only in English. Every spoken field (speech or narration) and your final reply must be English, even when the student uses Russian.",
        "Call unsolvable.observe_board before answering. Verify algebra with unsolvable.verify_math_step when applicable.",
        "For an explicit check or correction request involving a wrong numeric equation, use unsolvable.verify_arithmetic_equation on the proposed correction, mark only the mistaken stroke with unsolvable.board_feedback, then use unsolvable.board_write_equation to handwrite the valid equation in nearby free space. For example, if the student wrote 1 + 2 = 4, underline the 4 and write 1 + 2 = 3. For passive observation, respect the selected hint level and avoid giving away the full answer unless asked.",
        "When writing math, use ordinary lowercase variable letters and plain expressions such as x^3/3. Unsolvable renders ^ as a raised power, / as a fraction, and _ as a subscript. Do not send LaTeX commands or spell out punctuation. For a definite integral, evaluate the bounds; do not equate it to an indefinite antiderivative with +C.",
        "Use board_feedback, board_draw, board_erase, and board_say to teach on the board. For a diagram outside the fixed templates, use board_write_text for short labels and board_draw_arrow for arrows at observed board coordinates. These are editable pen strokes, and arrows do not attach to shapes. Respect the board's hint level.",
        "Use the fewest board actions that satisfy the request. Do not claim the board lacks text or arrows: check the available tools. If a requested layout still cannot be made with them, explain the specific missing operation and offer a usable fallback.",
        "Send at most one spoken message per turn. If you use multiple board tools, put speech or narration in only one tool call and leave the other spoken fields empty. Do not call board_say after a tool that already speaks.",
        "Do not edit source files or run shell commands. Give a short final response for the student's status display.",
        `Board ID: ${boardId}`,
        `Request trigger: ${String(body.trigger || "explicit").slice(0, 40)}`,
        `Student request: ${message}`,
      ].join("\n");
      const config = [
        "-c", `mcp_servers.unsolvable.url=${JSON.stringify(`${siteUrl}/mcp`)}`,
        "-c", "mcp_servers.unsolvable.enabled=true",
        "-c", 'mcp_servers.unsolvable.default_tools_approval_mode="approve"',
      ];
      const previous = sessions.get(boardId) ?? null;
      const args = previous
        ? ["exec", "resume", "--json", "--skip-git-repo-check", ...config, previous, prompt]
        : ["exec", "--json", "--sandbox", "read-only", "--skip-git-repo-check", ...config, prompt];
      let threadId = previous || null;
      let reply = "";
      let currentRun = null;
      const result = await runCodex(binary, args, env, (event) => {
        if (event.type === "bridge.child") {
          currentRun = { child: event.child, cancelled: false };
          running.set(boardId, currentRun);
        }
        if (event.type === "thread.started" && event.thread_id) threadId = event.thread_id;
        if (event.type === "item.completed" && event.item?.type === "agent_message") reply = event.item.text || reply;
      });
      const active = running.get(boardId);
      if (active?.child === result.child) running.delete(boardId);
      if (currentRun?.cancelled) return sendJson(response, 409, { error: "Codex turn stopped." }, origin);
      if (threadId) sessions.set(boardId, threadId);
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
    close: () => { for (const active of running.values()) active.child.kill(); server.close(); },
  };
}

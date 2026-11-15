import { spawn } from "node:child_process";

const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;

export class CodexAppServerError extends Error {
  constructor(message, details) {
    super(message);
    this.name = "CodexAppServerError";
    this.details = details;
  }
}

export class CodexAppServerClient {
  constructor({ binary, args = [], cwd = process.cwd(), env = process.env, spawnProcess = spawn }) {
    this.binary = binary;
    this.args = args;
    this.cwd = cwd;
    this.env = env;
    this.spawnProcess = spawnProcess;
    this.child = null;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Set();
    this.stderr = "";
    this.stdoutBuffer = "";
    this.closed = false;
  }

  async start() {
    if (this.child) return;
    this.closed = false;
    const child = this.spawnProcess(this.binary, ["app-server", "--listen", "stdio://", ...this.args], {
      cwd: this.cwd,
      env: this.env,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.child = child;
    child.stdout.on("data", (chunk) => this.handleStdout(chunk));
    child.stderr.on("data", (chunk) => { this.stderr = (this.stderr + chunk.toString()).slice(-8_000); });
    child.on("error", (error) => this.failAll(new CodexAppServerError(error.message, this.stderr)));
    child.on("exit", (code) => {
      const message = this.closed
        ? "Codex app-server stopped."
        : `Codex app-server exited${code === null ? "" : ` with code ${code}`}.`;
      this.failAll(new CodexAppServerError(message, this.stderr));
      this.child = null;
    });

    await this.request("initialize", {
      clientInfo: { name: "unsolvable-nyx", title: "Nyx local tutor", version: "0.1.0" },
      capabilities: {},
    });
    this.notify("initialized");
  }

  isRunning() {
    return Boolean(this.child && !this.closed);
  }

  onNotification(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  request(method, params = {}, timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS) {
    if (!this.child || this.closed) return Promise.reject(new CodexAppServerError("Codex app-server is not running.", this.stderr));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new CodexAppServerError(`Codex app-server request timed out: ${method}`, this.stderr));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timeout, method });
      this.write({ jsonrpc: "2.0", id, method, params });
    });
  }

  notify(method, params) {
    this.write({ jsonrpc: "2.0", method, ...(params === undefined ? {} : { params }) });
  }

  respond(id, result) {
    this.write({ jsonrpc: "2.0", id, result });
  }

  respondError(id, code, message) {
    this.write({ jsonrpc: "2.0", id, error: { code, message } });
  }

  write(message) {
    if (!this.child || this.closed) throw new CodexAppServerError("Codex app-server is not running.", this.stderr);
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  handleStdout(chunk) {
    this.stdoutBuffer += chunk.toString();
    for (let end = this.stdoutBuffer.indexOf("\n"); end !== -1; end = this.stdoutBuffer.indexOf("\n")) {
      const line = this.stdoutBuffer.slice(0, end).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(end + 1);
      if (!line) continue;
      try { this.handleMessage(JSON.parse(line)); } catch { /* Ignore non-protocol stdout. */ }
    }
  }

  handleMessage(message) {
    if (Object.hasOwn(message, "id") && (Object.hasOwn(message, "result") || Object.hasOwn(message, "error"))) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      clearTimeout(pending.timeout);
      this.pending.delete(message.id);
      if (message.error) pending.reject(new CodexAppServerError(message.error.message || `App-server request failed: ${pending.method}`, message.error));
      else pending.resolve(message.result);
      return;
    }

    if (typeof message.method !== "string") return;
    if (Object.hasOwn(message, "id")) {
      this.respondError(message.id, -32601, `Nyx does not support app-server request ${message.method}.`);
      return;
    }
    for (const listener of this.listeners) listener(message.method, message.params ?? {});
  }

  failAll(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pending.clear();
  }

  close() {
    this.closed = true;
    this.failAll(new CodexAppServerError("Codex app-server stopped.", this.stderr));
    this.child?.kill();
    this.child = null;
    this.listeners.clear();
  }
}

import { spawn } from "node:child_process";
import process from "node:process";
import { startLocalCodexBridge } from "./local-codex-bridge.mjs";

const bridge = await startLocalCodexBridge();
console.log(`Unsolvable local Codex bridge: ${bridge.url}`);

const child = spawn(process.execPath, ["scripts/run-framework.mjs", "dev"], {
  cwd: process.cwd(),
  env: { ...process.env, VITE_TUTOR_BRIDGE_URL: bridge.url },
  stdio: "inherit",
  windowsHide: true,
});

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  child.kill();
  bridge.close();
  setTimeout(() => process.exit(code), 250).unref();
}

child.on("exit", (code) => {
  if (!stopping) stop(code ?? 0);
});
child.on("error", (error) => {
  console.error(`Could not start the Unsolvable site: ${error.message}`);
  stop(1);
});

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

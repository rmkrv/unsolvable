import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import process from "node:process";
import { startLocalCodexBridge } from "./local-codex-bridge.mjs";

const wranglerConfig = "dist/server/wrangler.json";

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

if (!existsSync(wranglerConfig)) {
  run(process.execPath, ["scripts/run-framework.mjs", "build"]);
}

run(process.execPath, [
  "--import",
  "./scripts/sites-env.mjs",
  "./node_modules/wrangler/bin/wrangler.js",
  "d1",
  "execute",
  "DB",
  "--local",
  "--config",
  wranglerConfig,
  "--persist-to",
  ".wrangler/state",
  "--file",
  "drizzle/0000_dizzy_mephisto.sql",
]);

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


import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

export async function GET() {
  const pluginId = env.VECTOR_PLUGIN_ID?.trim();
  if (!pluginId) {
    return new Response(
      `<!doctype html><html><head><meta charset="utf-8"><title>Unsolvable connection</title></head><body style="font-family:system-ui;padding:40px;max-width:640px"><h1>Unsolvable is not published yet</h1><p>The Codex connection link becomes available after the Site's first MCP publication.</p><p>You can close this tab and continue using the local board.</p></body></html>`,
      { status: 503, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
    );
  }

  const prompt = `[@Unsolvable](plugin://${pluginId}) Observe my Unsolvable engineering board, use its deterministic verifier before judging supported algebra, and wait for meaningful board changes.`;
  const location = `codex://new?prompt=${encodeURIComponent(prompt)}`;
  return new Response(null, {
    status: 302,
    headers: { location, "cache-control": "private, no-store" },
  });
}

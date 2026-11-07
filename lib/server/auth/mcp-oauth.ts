import { env } from "cloudflare:workers";
import { createMcpAuth, type McpAuth } from "@neon/oauth/mcp";

const cache = new Map<string, McpAuth>();

export function mcpResourceUrl(request: Request) {
  const configured = env.MCP_RESOURCE_URL?.trim();
  return configured || `${new URL(request.url).origin}/mcp`;
}

export function getMcpOAuth(request: Request) {
  const resource = mcpResourceUrl(request);
  let oauth = cache.get(resource);
  if (!oauth) {
    oauth = createMcpAuth({
      baseUrl: env.NEON_AUTH_BASE_URL,
      resource,
      scopesSupported: ["openid", "profile", "email", "offline_access"],
    });
    cache.set(resource, oauth);
  }
  return oauth;
}

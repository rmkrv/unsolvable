import { getMcpOAuth } from "@/lib/server/auth/mcp-oauth";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return getMcpOAuth(request).handleMetadataRequest(request) ?? new Response("Not found", { status: 404 });
}

export function OPTIONS(request: Request) {
  return getMcpOAuth(request).handleMetadataRequest(request) ?? new Response(null, { status: 404 });
}

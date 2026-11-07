declare namespace Cloudflare {
  interface Env {
    BUCKET?: R2Bucket;
    DATABASE_URL: string;
    DATABASE_URL_UNPOOLED: string;
    NEON_AUTH_BASE_URL: string;
    NEON_AUTH_COOKIE_SECRET: string;
    NEON_AUTH_JWKS_URL?: string;
    MCP_RESOURCE_URL?: string;
  }
}

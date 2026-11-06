declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    VECTOR_PLUGIN_ID?: string;
    DATABASE_URL: string;
    DATABASE_URL_UNPOOLED: string;
    NEON_AUTH_BASE_URL: string;
    NEON_AUTH_COOKIE_SECRET: string;
  }
}

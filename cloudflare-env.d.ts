declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    VECTOR_PLUGIN_ID?: string;
  }
}

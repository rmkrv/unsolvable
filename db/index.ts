import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export function getDb() {
  return drizzle(env.DATABASE_URL, { schema });
}

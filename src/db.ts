// The only place that touches the D1 binding directly (CLAUDE.md rule 1).
// Every route/lib module gets its DB handle through `getDb(env)` — no
// second client, no direct D1 query from a route handler. If you need a
// query helper this doesn't expose yet, add it here.

import { drizzle } from "drizzle-orm/d1";
import * as schema from "./db/schema";

export type Env = {
  DB: D1Database;
  SESSION_SECRET: string;
  RESEND_API_KEY: string;
};

export function getDb(env: Env) {
  return drizzle(env.DB, { schema });
}

export type Db = ReturnType<typeof getDb>;

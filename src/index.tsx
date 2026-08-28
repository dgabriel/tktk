// Hono app entry. Route handlers stay thin (CLAUDE.md rule 3) — business
// logic belongs in src/lib/, views in src/views/. This currently has one
// real route, proving Workers + D1 binding + Drizzle + Hono JSX + htmx all
// boot together; the actual class/roster/auth routes (kickoff brief §5) are
// tracked as beads issues for `developer` rather than stubbed out here.

import { Hono } from "hono";
import type { Env } from "./db";
import { getDb } from "./db";
import { Layout } from "./views/Layout";

const app = new Hono<{ Bindings: Env }>();

app.get("/", async (c) => {
  // Touches the DB binding through the one sanctioned access point (src/db.ts)
  // to prove the D1 binding is wired correctly, even though this route has
  // nothing to query yet.
  getDb(c.env);

  return c.html(
    <Layout title="tktk">
      <main>
        <h1>tktk</h1>
        <p>Class + roster management — scaffolding in progress.</p>
      </main>
    </Layout>,
  );
});

export default app;

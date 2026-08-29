// Hono app entry. Route handlers stay thin (CLAUDE.md rule 3) — business
// logic belongs in src/lib/, views in src/views/. This currently has one
// real route, proving Workers + D1 binding + Drizzle + Hono JSX + htmx all
// boot together; the actual class/roster/auth routes (kickoff brief §5) are
// tracked as beads issues for `developer` rather than stubbed out here.

import { Hono } from "hono";
import type { Env } from "./db";
import { getDb } from "./db";
import { Layout } from "./views/Layout";
import { LoginPage, SignupPage } from "./views/Auth";
import { signupTeacher, verifyLogin } from "./lib/auth";
import { createSessionCookie } from "./lib/session";

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

app.get("/auth/login", (c) => c.html(<LoginPage />));

app.get("/auth/signup", (c) => c.html(<SignupPage />));

app.post("/auth/signup", async (c) => {
  const body = await c.req.parseBody();
  const username = String(body.username ?? "").trim();
  const email = String(body.email ?? "").trim();
  const name = String(body.name ?? "").trim();
  const password = String(body.password ?? "");

  const db = getDb(c.env);
  const result = await signupTeacher(db, { username, email, name: name || undefined, password });

  if (!result.ok) {
    return c.html(<SignupPage errors={result.errors} values={{ username, email, name }} />, 400);
  }

  await createSessionCookie(c, c.env.SESSION_SECRET, {
    userId: result.user.id,
    email: result.user.email,
    role: "teacher",
  });

  // No dashboard/class-list page yet (tktk-lfc.2) -- redirect to `/` for
  // now; this should become `/classes` once that route exists.
  return c.redirect("/", 303);
});

app.post("/auth/login", async (c) => {
  const body = await c.req.parseBody();
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");

  const db = getDb(c.env);
  const user = await verifyLogin(db, { username, password });

  if (!user) {
    // Generic message -- do not reveal whether the username exists or the
    // password was wrong (avoids username enumeration).
    return c.html(<LoginPage error="Invalid username or password." username={username} />, 400);
  }

  await createSessionCookie(c, c.env.SESSION_SECRET, {
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  // Same "no dashboard yet" note as signup above.
  return c.redirect("/", 303);
});

export default app;

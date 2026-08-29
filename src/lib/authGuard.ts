// Shared "is there a valid session, and is that user a teacher" guard.
// One implementation, applied per-route (not a blanket app.use on a path
// prefix) so a future route under /classes/* with different auth
// requirements -- e.g. a public invite-acceptance page (tktk-lfc.4) -- isn't
// silently caught by it. Every route this milestone builds under
// /classes/* (tktk-lfc.3/.4/.5/.6's teacher-facing parts) should reuse this
// rather than re-implementing the check.

import { createMiddleware } from "hono/factory";
import type { Env } from "../db";
import { readSession, type Variables } from "./session";

export const requireTeacher = createMiddleware<{ Bindings: Env; Variables: Variables }>(async (c, next) => {
  const session = await readSession(c, c.env.SESSION_SECRET);

  if (!session || session.role !== "teacher") {
    return c.redirect("/auth/login", 303);
  }

  c.set("session", session);
  await next();
});

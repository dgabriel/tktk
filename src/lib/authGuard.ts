// Shared "is there a valid session, and is that user a teacher" guard.
// One implementation, applied per-route (not a blanket app.use on a path
// prefix) so a future route under /classes/* with different auth
// requirements -- e.g. a public invite-acceptance page (tktk-lfc.4) -- isn't
// silently caught by it. Every route this milestone builds under
// /classes/* (tktk-lfc.3/.4/.5/.6's teacher-facing parts) should reuse this
// rather than re-implementing the check.

import { createMiddleware } from "hono/factory";
import { eq } from "drizzle-orm";
import type { Env } from "../db";
import { getDb } from "../db";
import { users } from "../db/schema";
import { readSession, clearSessionCookie, type Variables } from "./session";

export const requireTeacher = createMiddleware<{ Bindings: Env; Variables: Variables }>(async (c, next) => {
  const session = await readSession(c, c.env.SESSION_SECRET);

  if (!session || session.role !== "teacher") {
    return c.redirect("/auth/login", 303);
  }

  // A signed cookie only proves it was issued by us -- it doesn't prove the
  // user it names still exists. Normally those two things can't diverge,
  // but a local DB reset (or, in principle, a future account-deletion
  // feature) can leave a still-valid signature pointing at a row that's
  // gone -- which surfaced for real as an unhandled FOREIGN KEY constraint
  // failed 500 the first time it happened here (createClass inserting a
  // class_teachers row against a userId that no longer exists in users).
  // Checking existence here, once, at the single chokepoint every protected
  // route already goes through, is cheaper and more robust than defending
  // every individual insert that references session.userId.
  const exists = await sessionUserExists(c.env, session.userId);
  if (!exists) {
    clearSessionCookie(c);
    return c.redirect("/auth/login", 303);
  }

  c.set("session", session);
  await next();
});

async function sessionUserExists(env: Env, userId: string): Promise<boolean> {
  const db = getDb(env);
  const row = await db.query.users.findFirst({ where: eq(users.id, userId) });
  return !!row;
}

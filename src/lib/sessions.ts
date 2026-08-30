// Business logic for schedule-only class sessions (CLAUDE.md rule 3 -- route
// handlers in src/index.tsx stay thin). A session is a numbered meeting
// within a class: a number, an optional date, an optional title. Nothing
// submitted/attached to it yet -- see the module comment on classSessions in
// src/db/schema.ts for why that's deliberately out of scope here.

import { eq, max } from "drizzle-orm";
import type { Db } from "../db";
import { classSessions } from "../db/schema";

// Same "not just shaped right, a real calendar date" check as
// src/lib/classes.ts's isValidDateString -- duplicated rather than
// shared/imported, matching this codebase's existing precedent
// (isUniqueConstraintError is independently defined in both classes.ts and
// invites.ts rather than factored into a shared utils module).
function isValidDateString(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const date = new Date(`${s}T00:00:00Z`);
  return date.toISOString().slice(0, 10) === s;
}

function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Error && /unique constraint/i.test(err.message);
}

// Bounds the retry loop below rather than looping forever if something is
// badly wrong -- same reasoning as classes.ts's MAX_JOIN_CODE_ATTEMPTS.
const MAX_NUMBER_ATTEMPTS = 5;

export type CreateSessionInput = { classId: string; date?: string; title?: string };
export type CreateSessionFieldErrors = Partial<Record<"date", string>>;
export type CreateSessionResult = { ok: true; id: string } | { ok: false; errors: CreateSessionFieldErrors };

// number is auto-assigned (MAX(number)+1 for the class, defaulting to 1),
// never user-settable. The unique (classId, number) index (schema.ts) plus
// this bounded retry is what keeps two teachers adding a session to the same
// class at the same moment from racing onto the same number -- CLAUDE.md
// rule 5 treats multi-teacher concurrency as first-class, not an edge case,
// so this mirrors createClass's join-code retry loop rather than skipping it.
export async function createSession(db: Db, input: CreateSessionInput): Promise<CreateSessionResult> {
  const errors: CreateSessionFieldErrors = {};
  const date = input.date?.trim() || undefined;
  if (date && !isValidDateString(date)) errors.date = "That's not a valid date.";
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const title = input.title?.trim() || null;

  for (let attempt = 0; attempt < MAX_NUMBER_ATTEMPTS; attempt++) {
    const [row] = await db
      .select({ maxNumber: max(classSessions.number) })
      .from(classSessions)
      .where(eq(classSessions.classId, input.classId));
    const number = (row?.maxNumber ?? 0) + 1;

    try {
      const id = crypto.randomUUID();
      await db.insert(classSessions).values({
        id,
        classId: input.classId,
        number,
        date: date ?? null,
        title,
      });
      return { ok: true, id };
    } catch (err) {
      if (isUniqueConstraintError(err)) continue;
      throw err;
    }
  }

  throw new Error(`Could not assign a unique session number after ${MAX_NUMBER_ATTEMPTS} attempts.`);
}

export type ClassSessionItem = { id: string; number: number; date: string | null; title: string | null };

export async function listSessionsForClass(db: Db, classId: string): Promise<ClassSessionItem[]> {
  return db
    .select({ id: classSessions.id, number: classSessions.number, date: classSessions.date, title: classSessions.title })
    .from(classSessions)
    .where(eq(classSessions.classId, classId))
    .orderBy(classSessions.number);
}

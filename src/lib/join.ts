// Business logic for the student join-code enrollment flow (CLAUDE.md rule 3
// -- route handlers in src/index.tsx stay thin). tktk-lfc.5: unlike the
// invite flow (invites.ts), there's no invites row and no placeholder-user
// dance -- a join code resolves straight to a class, so both branches here
// (already logged in vs. fresh signup) create/attach the real class_students
// row directly.

import { eq, and } from "drizzle-orm";
import type { Db } from "../db";
import { classes, classStudents, users } from "../db/schema";
import { hashPassword } from "./password";
import { MIN_PASSWORD_LENGTH, normalizeEmail } from "./auth";
import { isUniqueConstraintError } from "./classes";

type ClassRef = { id: string; name: string };

// Join codes are generated uppercase-only (classes.ts's JOIN_CODE_ALPHABET),
// but a student typing one by hand may enter it lowercase or with stray
// whitespace -- normalize before matching rather than requiring an exact
// match to what was displayed.
function normalizeJoinCode(raw: string): string {
  return raw.trim().toUpperCase();
}

async function resolveJoinCode(db: Db, rawCode: string): Promise<ClassRef | null> {
  const code = normalizeJoinCode(rawCode);
  if (!code) return null;

  const row = await db.query.classes.findFirst({ where: eq(classes.joinCode, code) });
  return row ? { id: row.id, name: row.name } : null;
}

// ---------------------------------------------------------------------------
// Already-logged-in visitor: no signup fields, just attach the current
// session user to the class.

export type JoinExistingResult =
  | { ok: true; class: ClassRef }
  | { ok: false; status: "invalid_code" }
  | { ok: false; status: "already_member" }
  | { ok: false; status: "not_a_student" };

export async function joinClassAsExistingUser(
  db: Db,
  input: { joinCode: string; userId: string; role: "teacher" | "student" },
): Promise<JoinExistingResult> {
  // Kickoff brief §9.3: "Can a users row ever hold both teacher and student
  // roles? MVP assumes no -- flag if that's wrong." Left unrestricted, this
  // path would let a teacher account also become a class_students row (a
  // different class, functioning as a student there) without that dual-role
  // question ever being reviewed -- caught in review, not asked for. Enforce
  // the brief's stated default here rather than silently allowing it.
  if (input.role !== "student") return { ok: false, status: "not_a_student" };

  const classRef = await resolveJoinCode(db, input.joinCode);
  if (!classRef) return { ok: false, status: "invalid_code" };

  const existingMembership = await db.query.classStudents.findFirst({
    where: and(eq(classStudents.classId, classRef.id), eq(classStudents.userId, input.userId)),
  });
  if (existingMembership) return { ok: false, status: "already_member" };

  try {
    await db.insert(classStudents).values({
      classId: classRef.id,
      userId: input.userId,
      status: "active",
      joinedAt: new Date().toISOString(),
    });
  } catch (err) {
    // Concurrent join from two tabs racing past the pre-check above --
    // class_students' composite PK (classId, userId) rejects the second
    // insert. Same pattern as addCoTeacher/acceptInvite.
    if (isUniqueConstraintError(err)) return { ok: false, status: "already_member" };
    throw err;
  }

  return { ok: true, class: classRef };
}

// ---------------------------------------------------------------------------
// No session: full signup (join code + email + password). Email is the
// sole identity/login field -- no separate username.

export type JoinSignupInput = { joinCode: string; email: string; password: string };

export type JoinSignupFieldErrors = Partial<Record<"email" | "password", string>>;

export type JoinSignupResult =
  | { ok: true; user: { id: string; email: string }; class: ClassRef }
  | { ok: false; status: "invalid_code" }
  | { ok: false; status: "validation"; errors: JoinSignupFieldErrors }
  | { ok: false; status: "conflict" };

export async function joinClassWithSignup(db: Db, input: JoinSignupInput): Promise<JoinSignupResult> {
  // Must resolve before any user-creation work: an invalid code must never
  // be able to create an account as a side effect of trying (auth-
  // correctness requirement named in tktk-lfc.5).
  const classRef = await resolveJoinCode(db, input.joinCode);
  if (!classRef) return { ok: false, status: "invalid_code" };

  const errors: JoinSignupFieldErrors = {};
  const email = normalizeEmail(input.email);

  if (!email) errors.email = "Email is required.";
  if (!input.password || input.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  if (Object.keys(errors).length === 0) {
    const existingEmail = await db.query.users.findFirst({ where: eq(users.email, email) });
    // A different account already owns this email -- don't silently attach
    // to it. Someone who already has an account should log in and use the
    // "already logged in" join path instead (joinClassAsExistingUser).
    if (existingEmail) {
      errors.email = "That email is already registered. Log in, then enter the join code again.";
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, status: "validation", errors };

  const passwordHash = await hashPassword(input.password);
  const id = crypto.randomUUID();

  try {
    await db.batch([
      db.insert(users).values({ id, passwordHash, email, name: null, role: "student" }),
      db.insert(classStudents).values({ classId: classRef.id, userId: id, status: "active", joinedAt: new Date().toISOString() }),
    ]);
  } catch (err) {
    // Concurrent signup racing past the uniqueness pre-check above (e.g. two
    // requests for the same email submitted at once) -- surface as a clean
    // rejection, not an uncaught 500. Same pattern as acceptInvite's
    // conflict handling.
    if (isUniqueConstraintError(err)) return { ok: false, status: "conflict" };
    throw err;
  }

  return { ok: true, user: { id, email }, class: classRef };
}

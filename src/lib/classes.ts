// Business logic for class creation/listing/detail (CLAUDE.md rule 3 --
// route handlers in src/index.tsx stay thin). Join-code generation/collision
// retry and the class+owner-row creation live here.

import { eq, and } from "drizzle-orm";
import type { Db } from "../db";
import { classes, classTeachers, classStudents, invites, users } from "../db/schema";
import { normalizeEmail } from "./auth";

// Human-typeable join code: uppercase letters + digits, excluding visually
// ambiguous characters (0/O, 1/I) per kickoff brief §3.
const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const JOIN_CODE_LENGTH = 6;
// Kickoff brief §9.2 / CLAUDE.md "Decisions made during scaffolding": generate,
// retry on unique-constraint violation. This bounds the retry loop rather
// than looping forever if something is badly wrong with code generation.
const MAX_JOIN_CODE_ATTEMPTS = 5;

function generateJoinCode(): string {
  let code = "";
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
    code += JOIN_CODE_ALPHABET[Math.floor(Math.random() * JOIN_CODE_ALPHABET.length)];
  }
  return code;
}

export function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Error && /unique constraint/i.test(err.message);
}

// Format an <input type="date"> submits: YYYY-MM-DD. Checks it's not just
// shaped right but a real calendar date -- JS Date silently rolls invalid
// ones over (e.g. "2026-02-30" becomes March 2) rather than rejecting them,
// so round-trip through ISO and compare rather than trusting `new Date()`
// not to throw.
function isValidDateString(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const date = new Date(`${s}T00:00:00Z`);
  return date.toISOString().slice(0, 10) === s;
}

export type CreateClassInput = {
  name: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  createdBy: string;
};

export type CreateClassFieldErrors = Partial<Record<"name" | "startDate" | "endDate", string>>;

export type CreateClassResult = { ok: true; id: string } | { ok: false; errors: CreateClassFieldErrors };

// Creates the class row and its owner class_teachers row together, via
// db.batch() -- D1's Drizzle driver doesn't support interactive (session)
// transactions, but batch() runs its statements atomically (all-or-nothing),
// which is what keeps a class from ever existing without its owner row. That
// atomicity also makes it safe to retry the whole pair on a join_code
// collision: a failed attempt never leaves an orphaned classes row behind.
export async function createClass(db: Db, input: CreateClassInput): Promise<CreateClassResult> {
  const errors: CreateClassFieldErrors = {};
  const name = input.name.trim();
  if (!name) errors.name = "Class name is required.";

  // Both dates are optional, matching the free-text term field they
  // replace (tktk-lfc.11) -- only validated if actually provided.
  const startDate = input.startDate?.trim() || undefined;
  const endDate = input.endDate?.trim() || undefined;
  if (startDate && !isValidDateString(startDate)) errors.startDate = "That's not a valid date.";
  if (endDate && !isValidDateString(endDate)) errors.endDate = "That's not a valid date.";
  if (startDate && endDate && !errors.startDate && !errors.endDate && endDate < startDate) {
    // Plain string comparison is chronologically correct for zero-padded
    // ISO YYYY-MM-DD -- no need to parse into Date objects to compare.
    errors.endDate = "End date can't be before the start date.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const id = crypto.randomUUID();

  for (let attempt = 0; attempt < MAX_JOIN_CODE_ATTEMPTS; attempt++) {
    const joinCode = generateJoinCode();
    try {
      await db.batch([
        db.insert(classes).values({
          id,
          name,
          description: input.description?.trim() || null,
          startDate: startDate ?? null,
          endDate: endDate ?? null,
          joinCode,
          createdBy: input.createdBy,
        }),
        db.insert(classTeachers).values({
          classId: id,
          userId: input.createdBy,
          role: "owner",
        }),
      ]);
      return { ok: true, id };
    } catch (err) {
      if (isUniqueConstraintError(err)) continue;
      throw err;
    }
  }

  throw new Error(`Could not generate a unique join code after ${MAX_JOIN_CODE_ATTEMPTS} attempts.`);
}

export type ClassListItem = {
  id: string;
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  joinCode: string;
};

// Scoped by class_teachers.userId, not classes.created_by -- created_by is
// an audit field (who originally created the class), not the
// access-control source of truth. A future co-teacher (tktk-lfc.3) will have
// a class_teachers row without being created_by, and this must already
// return their classes too (CLAUDE.md rule 5).
export async function listClassesForTeacher(db: Db, userId: string): Promise<ClassListItem[]> {
  return db
    .select({
      id: classes.id,
      name: classes.name,
      description: classes.description,
      startDate: classes.startDate,
      endDate: classes.endDate,
      joinCode: classes.joinCode,
    })
    .from(classTeachers)
    .innerJoin(classes, eq(classTeachers.classId, classes.id))
    .where(eq(classTeachers.userId, userId));
}

export type ClassDetail = {
  id: string;
  name: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  joinCode: string;
  teachers: Array<{
    userId: string;
    name: string | null;
    email: string;
    role: string;
  }>;
  students: Array<{
    userId: string;
    name: string | null;
    email: string;
  }>;
};

// Returns null both when the class doesn't exist and when the requesting
// teacher isn't one of its class_teachers rows -- callers must treat both
// the same (404/redirect), not distinguish them, so a teacher can't tell
// "no such class" from "someone else's class" by probing ids.
export async function getClassDetailForTeacher(
  db: Db,
  classId: string,
  userId: string,
): Promise<ClassDetail | null> {
  const classRow = await db.query.classes.findFirst({ where: eq(classes.id, classId) });
  if (!classRow) return null;

  const membership = await db.query.classTeachers.findFirst({
    where: and(eq(classTeachers.classId, classId), eq(classTeachers.userId, userId)),
  });
  if (!membership) return null;

  const teacherRows = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      role: classTeachers.role,
    })
    .from(classTeachers)
    .innerJoin(users, eq(classTeachers.userId, users.id))
    .where(eq(classTeachers.classId, classId));

  // Active only -- invited-but-not-yet-joined rows are surfaced separately
  // via listPendingInvites (invites.ts), not mixed into this roster list.
  const studentRows = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
    })
    .from(classStudents)
    .innerJoin(users, eq(classStudents.userId, users.id))
    .where(and(eq(classStudents.classId, classId), eq(classStudents.status, "active")));

  return {
    id: classRow.id,
    name: classRow.name,
    description: classRow.description,
    startDate: classRow.startDate,
    endDate: classRow.endDate,
    joinCode: classRow.joinCode,
    teachers: teacherRows,
    students: studentRows,
  };
}

export type AddCoTeacherResult = { ok: true } | { ok: false; error: string };

// Adds an existing teacher account to a class as a co-teacher. Unlike the
// student-invite flow (tktk-lfc.4), this has no signup-via-link step --
// co-teachers are presumed already registered instructors, so a lookup miss
// (or a hit against a non-teacher account) is a rejected request, not the
// start of an invite. Any current teacher on the class may call this (kickoff
// brief §2: no class-level hierarchy beyond owner/co-teacher) -- callers are
// responsible for the class-membership check via getClassDetailForTeacher,
// same as the existing /invites route.
export async function addCoTeacher(db: Db, input: { classId: string; email: string }): Promise<AddCoTeacherResult> {
  const email = normalizeEmail(input.email);
  if (!email) return { ok: false, error: "Email is required." };

  const candidate = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!candidate || candidate.role !== "teacher") {
    return { ok: false, error: "No teacher account found with that email." };
  }

  const existingMembership = await db.query.classTeachers.findFirst({
    where: and(eq(classTeachers.classId, input.classId), eq(classTeachers.userId, candidate.id)),
  });
  if (existingMembership) {
    return { ok: false, error: "This person is already a teacher on this class." };
  }

  try {
    await db.insert(classTeachers).values({
      classId: input.classId,
      userId: candidate.id,
      role: "co-teacher",
    });
  } catch (err) {
    // Concurrent add of the same co-teacher (double-click, two tabs) racing
    // past the existingMembership check above -- class_teachers' composite
    // PK (classId, userId) rejects the second insert. Same pattern as
    // acceptInvite's conflict handling in invites.ts: surface as a clean
    // rejection, not an uncaught 500.
    if (isUniqueConstraintError(err)) {
      return { ok: false, error: "This person is already a teacher on this class." };
    }
    throw err;
  }

  return { ok: true };
}

export type RemoveClassMemberResult = { ok: true } | { ok: false; error: "not_found" };

// Backs DELETE /classes/:id/students/:userId (kickoff brief §5). One route
// covers two different underlying cases, because of how invites.ts's
// placeholder-user pattern already works:
//   - class_students.status === "active": userId is a real, joined
//     student's users row -- just delete the class_students row.
//   - class_students.status === "invited": userId is actually the
//     placeholder users row invites.ts created at invite time, sharing the
//     invite's own id (see invites.ts module comment). Removing this is
//     really "revoke the invite," not "remove a student who never joined" --
//     delete class_students, delete the now-unreferenced placeholder users
//     row, and mark the invites row revoked. Mirrors the cleanup
//     attachInviteToExistingUser (invites.ts) already does for its own
//     placeholder-cleanup case, including the delete order (class_students
//     before users) so nothing ever references the placeholder row at the
//     moment it's removed -- D1 checks FKs per-statement, not just at commit.
// Callers are responsible for the class-membership check (via
// getClassDetailForTeacher) before calling this, same as addCoTeacher.
export async function removeClassMember(
  db: Db,
  input: { classId: string; userId: string },
): Promise<RemoveClassMemberResult> {
  const membership = await db.query.classStudents.findFirst({
    where: and(eq(classStudents.classId, input.classId), eq(classStudents.userId, input.userId)),
  });
  if (!membership) return { ok: false, error: "not_found" };

  if (membership.status === "active") {
    await db
      .delete(classStudents)
      .where(and(eq(classStudents.classId, input.classId), eq(classStudents.userId, input.userId)));
    return { ok: true };
  }

  await db.batch([
    db
      .delete(classStudents)
      .where(and(eq(classStudents.classId, input.classId), eq(classStudents.userId, input.userId))),
    db.delete(users).where(eq(users.id, input.userId)),
    db.update(invites).set({ status: "revoked" }).where(eq(invites.id, input.userId)),
  ]);
  return { ok: true };
}

// Business logic for the teacher-invite flow (CLAUDE.md rule 3 -- route
// handlers in src/index.tsx stay thin). Covers creating an invite, looking
// one up by token for the public acceptance page, and completing signup.
//
// Schema note (a real gap the kickoff brief/schema didn't anticipate):
// class_students.user_id is NOT NULL and FK'd to users.id, but an invited
// student has no users row yet -- signup only happens at acceptance. A
// first attempt at this left class_students.userId dangling until
// acceptance, assuming SQLite/D1 doesn't check FKs on insert -- that's
// wrong, D1 enforces them eagerly per-statement (confirmed against local
// wrangler dev: `FOREIGN KEY constraint failed`). Fixed by inserting an
// actual placeholder `users` row in the same db.batch() as the invite,
// *before* the class_students row that references it, keeping the invite +
// class_students atomicity the task asked for (matching createClass's
// pattern) without violating the FK. The placeholder:
//   - reuses the invite's own id as its id (so acceptInvite can find it
//     later with no extra lookup/column -- it already has invite.id in
//     hand from the token lookup)
//   - gets an unusable passwordHash (satisfies NOT NULL, never logs in) and
//     a `*.invalid` email (RFC 2606-reserved, so it can never collide with a
//     real signup and, just as importantly, never makes
//     getInviteForAcceptance's "does a real user already have this email"
//     check trip over its own placeholder)
// acceptInvite then UPDATEs that same row in place (id unchanged) with the
// real password/email chosen at signup, rather than inserting a second row.
// attachInviteToExistingUser (the already-has-an-account path)
// repoints class_students at the real user and deletes the now-unreferenced
// placeholder.
//
// Known gap: an invite that expires (or is revoked) without being accepted
// leaves its placeholder users/class_students rows behind inert -- nothing
// currently queries or displays them (the pending-invites list reads
// `invites` directly, not class_students), so this is inert clutter, not a
// correctness bug, but flag to product-manager if a cleanup pass is wanted.

import { eq, and } from "drizzle-orm";
import type { Db } from "../db";
import { invites, classStudents, classes, users } from "../db/schema";
import { hashPassword } from "./password";
import { MIN_PASSWORD_LENGTH, normalizeEmail } from "./auth";
import type { SignupFieldErrors } from "./auth";

const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days, per CLAUDE.md
// RFC 2606-reserved TLD -- guaranteed never to be a real, resolvable domain,
// so a placeholder email built from it can never collide with a real user's.
const PLACEHOLDER_EMAIL_DOMAIN = "placeholder.invalid";

function generateInviteToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Error && /unique constraint/i.test(err.message);
}

function placeholderEmail(id: string): string {
  return `invite-pending-${id}@${PLACEHOLDER_EMAIL_DOMAIN}`;
}

// ---------------------------------------------------------------------------
// Creating an invite

export type CreateInviteInput = { classId: string; email: string; invitedBy: string };
export type CreateInviteResult = { ok: true; token: string } | { ok: false; error: string };

export async function createInvite(db: Db, input: CreateInviteInput): Promise<CreateInviteResult> {
  const email = normalizeEmail(input.email);
  if (!email) return { ok: false, error: "Email is required." };

  // Not specified in the kickoff brief -- conservative default (documented
  // in CLAUDE.md alongside the other scaffolding-time decisions): a second
  // *pending* invite to the same class+email is rejected rather than
  // creating a duplicate row. Expired/revoked/accepted invites don't block
  // a fresh one.
  const existingPending = await db.query.invites.findFirst({
    where: and(eq(invites.classId, input.classId), eq(invites.email, email), eq(invites.status, "pending")),
  });
  if (existingPending) {
    return { ok: false, error: "This email already has a pending invite for this class." };
  }

  // Also guard the case where this email already belongs to a real user who
  // is already a member (invited or active) of this class -- otherwise a
  // re-invite after acceptance would silently create a second,
  // never-reconciled class_students row for the same person (see the
  // placeholder-userId note above: each new invite gets its own placeholder
  // id, so this isn't caught by the pending-invite check alone).
  const existingUser = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existingUser) {
    const existingMembership = await db.query.classStudents.findFirst({
      where: and(eq(classStudents.classId, input.classId), eq(classStudents.userId, existingUser.id)),
    });
    if (existingMembership) {
      return {
        ok: false,
        error:
          existingMembership.status === "active"
            ? "This person is already a student in this class."
            : "This person has already accepted an invite to this class.",
      };
    }
  }

  const id = crypto.randomUUID();
  const token = generateInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS).toISOString();
  // Placeholder password nobody knows -- a real PBKDF2 hash (correct format,
  // so verifyPassword's parsing never chokes on it) of a value that's
  // thrown away immediately, not a hand-rolled fake-format string.
  const placeholderPasswordHash = await hashPassword(crypto.randomUUID());

  await db.batch([
    // Must precede the class_students insert below -- it references this
    // row's id via a FK D1 enforces eagerly per-statement, not just at
    // commit. See module-level note.
    db.insert(users).values({
      id,
      passwordHash: placeholderPasswordHash,
      email: placeholderEmail(id),
      name: null,
      role: "student",
    }),
    db.insert(invites).values({
      id,
      classId: input.classId,
      email,
      token,
      invitedBy: input.invitedBy,
      expiresAt,
      status: "pending",
    }),
    db.insert(classStudents).values({ classId: input.classId, userId: id, status: "invited" }),
  ]);

  return { ok: true, token };
}

// `id` doubles as the placeholder users row's id (see module note above) --
// this is what lets the roster view point the same DELETE
// /classes/:id/students/:userId route at a pending invite's "Revoke" button.
export type PendingInvite = { id: string; email: string; createdAt: string };

export async function listPendingInvites(db: Db, classId: string): Promise<PendingInvite[]> {
  return db
    .select({ id: invites.id, email: invites.email, createdAt: invites.createdAt })
    .from(invites)
    .where(and(eq(invites.classId, classId), eq(invites.status, "pending")));
}

// ---------------------------------------------------------------------------
// Looking up an invite for the public acceptance page

type InviteRef = { id: string; classId: string; email: string; className: string };

export type InviteLookup =
  | { status: "not_found" }
  | { status: "expired" }
  | { status: "accepted" }
  | { status: "revoked" }
  | { status: "existing_account"; invite: InviteRef }
  | { status: "valid"; invite: InviteRef };

export async function getInviteForAcceptance(db: Db, token: string): Promise<InviteLookup> {
  const row = await db.query.invites.findFirst({ where: eq(invites.token, token) });
  if (!row) return { status: "not_found" };

  if (row.status === "accepted") return { status: "accepted" };
  if (row.status === "revoked") return { status: "revoked" };

  const isExpired = row.status === "expired" || new Date(row.expiresAt).getTime() < Date.now();
  if (isExpired) {
    if (row.status === "pending") {
      await db.update(invites).set({ status: "expired" }).where(eq(invites.id, row.id));
    }
    return { status: "expired" };
  }

  const classRow = await db.query.classes.findFirst({ where: eq(classes.id, row.classId) });
  const invite: InviteRef = { id: row.id, classId: row.classId, email: row.email, className: classRow?.name ?? "this class" };

  // Edge case, not an error: someone re-invited an existing account, or the
  // same person was invited to a second class. Don't try to create a second
  // users row for that email -- surface it distinctly so the acceptance
  // page can point them to log in instead.
  const existingUser = await db.query.users.findFirst({ where: eq(users.email, row.email) });
  if (existingUser) return { status: "existing_account", invite };

  return { status: "valid", invite };
}

// If the visitor hitting GET /invites/:token is already logged in as the
// exact account the invite's email belongs to, skip the signup form
// entirely and just attach them to the class. Caller (route handler) is
// responsible for confirming session.email matches the invite's email
// before calling this.
export type AttachInviteResult = { ok: true } | { ok: false };

export async function attachInviteToExistingUser(
  db: Db,
  input: { token: string; userId: string },
): Promise<AttachInviteResult> {
  const row = await db.query.invites.findFirst({ where: eq(invites.token, input.token) });
  if (!row || row.status !== "pending") return { ok: false };
  if (new Date(row.expiresAt).getTime() < Date.now()) return { ok: false };

  await db.batch([
    db.update(invites).set({ status: "accepted" }).where(eq(invites.id, row.id)),
    // Repoint class_students at the real, already-existing user -- must run
    // before the placeholder delete below, so nothing ever references the
    // placeholder row at the moment it's removed (D1 checks FKs
    // per-statement, not just at commit).
    db
      .update(classStudents)
      .set({ userId: input.userId, status: "active", joinedAt: new Date().toISOString() })
      .where(and(eq(classStudents.classId, row.classId), eq(classStudents.userId, row.id))),
    // The placeholder user row (id === row.id, see module-level note) is
    // now unreferenced -- clean it up rather than leaving inert junk.
    db.delete(users).where(eq(users.id, row.id)),
  ]);

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Completing signup from the acceptance form

export type AcceptInviteInput = { token: string; password: string; name?: string };

export type AcceptInviteResult =
  | { ok: true; user: { id: string; email: string } }
  | { ok: false; status: "not_found" | "expired" | "accepted" | "revoked" }
  | { ok: false; status: "existing_account"; email: string }
  | { ok: false; status: "validation"; errors: SignupFieldErrors }
  | { ok: false; status: "conflict" };

export async function acceptInvite(db: Db, input: AcceptInviteInput): Promise<AcceptInviteResult> {
  const lookup = await getInviteForAcceptance(db, input.token);
  if (lookup.status === "existing_account") {
    return { ok: false, status: "existing_account", email: lookup.invite.email };
  }
  if (lookup.status !== "valid") return { ok: false, status: lookup.status };

  const invite = lookup.invite;
  const errors: SignupFieldErrors = {};

  if (!input.password || input.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, status: "validation", errors };

  const passwordHash = await hashPassword(input.password);

  try {
    await db.batch([
      // Converts the placeholder row created at invite time (same id --
      // see module-level note) into the real student account in place,
      // rather than inserting a second row. invite.email is already
      // guaranteed non-colliding (getInviteForAcceptance's existing_account
      // check above), so no email uniqueness check is needed here.
      db
        .update(users)
        .set({ passwordHash, email: invite.email, name: input.name?.trim() || null })
        .where(eq(users.id, invite.id)),
      db.update(invites).set({ status: "accepted" }).where(eq(invites.id, invite.id)),
      db
        .update(classStudents)
        .set({ status: "active", joinedAt: new Date().toISOString() })
        .where(and(eq(classStudents.classId, invite.classId), eq(classStudents.userId, invite.id))),
    ]);
  } catch (err) {
    // Concurrent accept of the same invite (double-submit, two tabs), or a
    // new account taking invite.email in the gap between
    // getInviteForAcceptance's existing_account check above and this update
    // -- either way the users.email unique constraint catches it. Surface
    // as a distinct, non-crashing state rather than a 500.
    if (isUniqueConstraintError(err)) return { ok: false, status: "conflict" };
    throw err;
  }

  return { ok: true, user: { id: invite.id, email: invite.email } };
}

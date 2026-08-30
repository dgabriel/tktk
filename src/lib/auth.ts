// Business logic for email/password signup + login (CLAUDE.md rule 3 --
// route handlers in src/index.tsx stay thin; uniqueness checks, hashing, and
// user creation live here). Email is the sole identity/login field -- no
// separate username; display name / profile fields are deferred.

import { eq } from "drizzle-orm";
import type { Db } from "../db";
import { users } from "../db/schema";
import { hashPassword, verifyPassword } from "./password";

// Nothing in the kickoff brief specified a password policy -- this is a
// conservative MVP default (documented in CLAUDE.md), not a final product
// decision. Revisit with product-manager if a stricter policy is wanted.
export const MIN_PASSWORD_LENGTH = 8;

// Email is the sole identity/login field now (tktk-lfc.9) -- SQLite's
// unique index is case-sensitive by default, so without normalization
// "a@x.com" and "A@x.com" would pass the uniqueness check as two different
// accounts. Domain part of an email is explicitly case-insensitive per
// RFC 5321/5322, and local-part case sensitivity is allowed by spec but
// essentially never used in practice -- lowercasing the whole address is
// the standard, pragmatic approach every major provider takes. Every
// module that reads, compares, or stores a user's email goes through this
// (auth.ts, join.ts, invites.ts, classes.ts) -- don't compare/store a raw
// `input.email` anywhere.
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export type SignupInput = {
  email: string;
  name?: string;
  password: string;
};

export type SignupFieldErrors = Partial<Record<"email" | "password", string>>;

export type SignupResult =
  | { ok: true; user: { id: string; email: string } }
  | { ok: false; errors: SignupFieldErrors };

// Teacher self-registration only -- there is no public student signup.
// Students get accounts via invite-acceptance (tktk-lfc.4) or join-code
// (tktk-lfc.5), both separate not-yet-built flows with their own
// signup-like logic reusing password.ts. See CLAUDE.md "Decisions made
// during scaffolding."
export async function signupTeacher(db: Db, input: SignupInput): Promise<SignupResult> {
  const errors: SignupFieldErrors = {};
  const email = normalizeEmail(input.email);

  if (!email) errors.email = "Email is required.";
  if (!input.password || input.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  if (Object.keys(errors).length === 0) {
    const existingEmail = await db.query.users.findFirst({ where: eq(users.email, email) });
    // Duplicate email at signup IS a specific, distinguishable error -- a
    // user filling out the form needs to know what to fix. This is
    // deliberately different from login's generic-error requirement in
    // verifyLogin below (no email enumeration there).
    if (existingEmail) errors.email = "That email is already registered.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const passwordHash = await hashPassword(input.password);
  const id = crypto.randomUUID();

  await db.insert(users).values({
    id,
    passwordHash,
    email,
    name: input.name || null,
    role: "teacher",
  });

  return { ok: true, user: { id, email } };
}

export type LoginInput = { email: string; password: string };
export type LoginResult = { id: string; email: string; role: "teacher" | "student" };

// A fixed dummy hash (real PBKDF2 output for an arbitrary password) so a
// nonexistent-email lookup still pays the same verifyPassword cost as a
// wrong-password one below -- without this, "no such user" returns
// immediately while "wrong password" runs a full 210k-iteration PBKDF2
// derivation, and that timing gap is enough to enumerate valid emails
// against the login form even though both cases return an identical error
// message. Content-level genericness alone doesn't close a timing
// side-channel.
const DUMMY_PASSWORD_HASH =
  "pbkdf2$210000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

// Generic failure for both "no such user" and "wrong password" -- the
// caller must not be able to distinguish the two (avoids email
// enumeration via the login form), including via response timing.
export async function verifyLogin(db: Db, input: LoginInput): Promise<LoginResult | null> {
  const user = await db.query.users.findFirst({ where: eq(users.email, normalizeEmail(input.email)) });

  const valid = await verifyPassword(input.password, user ? user.passwordHash : DUMMY_PASSWORD_HASH);
  if (!user || !valid) return null;

  return { id: user.id, email: user.email, role: user.role as "teacher" | "student" };
}

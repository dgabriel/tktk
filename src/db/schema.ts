// Drizzle schema for tktk's class + roster MVP.
//
// Written Postgres-compatible per CLAUDE.md rule 2, even though this runs on
// D1/SQLite today: no SQLite-only types (no `integer("x", { mode: "boolean" })`
// tricks beyond what maps cleanly to a real boolean column later, no
// `AUTOINCREMENT`, timestamps stored as ISO text so a future `timestamp`
// column in Postgres is a drop-in swap rather than a format migration).
//
// Tables match kickoff brief §3 (users, classes, class_teachers,
// class_students, invites) plus `login_tokens`, added during scaffolding —
// see CLAUDE.md "Decisions made during scaffolding" for why.

import { sqliteTable, text, primaryKey } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

const timestamp = (name: string) => text(name);
const nowDefault = sql`(current_timestamp)`;

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  // 'teacher' | 'student' — set at creation, not changed. See CLAUDE.md /
  // kickoff brief §9.3: MVP assumes a user never holds both roles.
  role: text("role").notNull(),
  createdAt: timestamp("created_at").notNull().default(nowDefault),
});

export const classes = sqliteTable("classes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  term: text("term"),
  // Short, human-typeable join code (e.g. 6-char base32). Lives on `classes`
  // per kickoff brief §3's default (one code per class, regenerable) rather
  // than its own table — revisit if code rotation/expiry is needed later.
  joinCode: text("join_code").notNull().unique(),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").notNull().default(nowDefault),
});

export const classTeachers = sqliteTable(
  "class_teachers",
  {
    classId: text("class_id")
      .notNull()
      .references(() => classes.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    // 'owner' | 'co-teacher'. Multi-teacher is first-class (CLAUDE.md rule
    // 5) — never assume a class has exactly one row here.
    role: text("role").notNull(),
    addedAt: timestamp("added_at").notNull().default(nowDefault),
  },
  (table) => [primaryKey({ columns: [table.classId, table.userId] })],
);

export const classStudents = sqliteTable(
  "class_students",
  {
    classId: text("class_id")
      .notNull()
      .references(() => classes.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    // 'invited' | 'active'
    status: text("status").notNull(),
    joinedAt: timestamp("joined_at"),
  },
  (table) => [primaryKey({ columns: [table.classId, table.userId] })],
);

export const invites = sqliteTable("invites", {
  id: text("id").primaryKey(),
  classId: text("class_id")
    .notNull()
    .references(() => classes.id),
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  invitedBy: text("invited_by")
    .notNull()
    .references(() => users.id),
  expiresAt: timestamp("expires_at").notNull(),
  // 'pending' | 'accepted' | 'expired' | 'revoked'
  status: text("status").notNull(),
  createdAt: timestamp("created_at").notNull().default(nowDefault),
});

// Added during scaffolding — not in kickoff brief §3. Backs the *non-invite*
// magic-link login (an existing user logging back in, or the join-code
// flow's own magic link) — `invites` only covers the teacher→student invite
// path. See CLAUDE.md "Decisions made during scaffolding."
export const loginTokens = sqliteTable("login_tokens", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().default(nowDefault),
});

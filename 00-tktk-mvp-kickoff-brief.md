# tktk — MVP Kickoff Brief

**Status:** Draft for scaffolding
**Scope:** MVP (not PoC) — class + roster management only
**Stack:** Cloudflare Workers (Hono) + D1 (Drizzle) + htmx 4.0 (server-rendered via Hono JSX) + Resend (auth)
**Agentic workflow:** Claude Code, MMC-style subagents, beads (`bd`) for issue tracking

---

## 1. What this MVP is (and isn't)

**In scope:**
- Teachers can create classes.
- Classes can have multiple teachers (co-taught workshops).
- Students can join a class two ways: teacher-sent email invite, or self-serve join code.
- Teachers can see and manage their class roster.
- Auth via Resend magic link for both teachers and students.

**Explicitly out of scope for this MVP** (do not build, do not scaffold placeholder tables for these unless the schema decision below calls for it):
- Assignments, prompts, submissions
- Feedback, grading, comments
- Peer review / workshop rounds
- Notifications beyond invite emails
- Billing/payments

This is deliberately narrower than the writing-workshop LMS vision — it's the foundation (org/roster layer) that assignments and workshop flow will sit on top of in a later milestone.

---

## 2. Tenancy & roles

- **Multi-teacher, shared classes.** A class can have more than one teacher (`owner` + `co-teacher` roles on the class). No class-level teacher hierarchy beyond that distinction.
- **Students belong to classes, not to teachers.** A student's identity is a `users` row with `role = student`; their relationship to a class lives in a join table.
- No school/org-level entity in this MVP — a "workspace" or "school" concept is deferred. Classes are the top-level container.

---

## 3. Data model (Drizzle, Postgres-compatible schema per tktk convention)

All access through `src/db.ts`, per existing tktk convention. Schema written Postgres-compatible even though MVP runs on D1/SQLite.

```
users
  id            text PK (uuid)
  email         text unique, not null
  name          text
  role          text not null  -- 'teacher' | 'student'  (a user can hold both over time, but role is set at creation; revisit if a person needs both roles)
  created_at    timestamp not null default now()

classes
  id            text PK (uuid)
  name          text not null
  description   text
  term          text            -- e.g. "Fall 2026", freeform for MVP
  join_code     text unique not null   -- short, human-typeable, e.g. 6-char base32
  created_by    text not null references users(id)
  created_at    timestamp not null default now()

class_teachers
  class_id      text not null references classes(id)
  user_id       text not null references users(id)
  role          text not null  -- 'owner' | 'co-teacher'
  added_at      timestamp not null default now()
  PRIMARY KEY (class_id, user_id)

class_students
  class_id      text not null references classes(id)
  user_id       text not null references users(id)
  status        text not null  -- 'invited' | 'active'
  joined_at     timestamp

invites
  id            text PK (uuid)
  class_id      text not null references classes(id)
  email         text not null
  token         text unique not null
  invited_by    text not null references users(id)
  expires_at    timestamp not null
  status        text not null  -- 'pending' | 'accepted' | 'expired' | 'revoked'
  created_at    timestamp not null default now()
```

Open question to resolve during scaffolding: does `join_code` live on `classes` (one code per class, regenerable) or as its own table (supports multiple active codes / expiry)? Default to on-`classes` for MVP simplicity; revisit if you need code rotation.

---

## 4. Auth flow

Both invite paths converge on the same Resend magic-link mechanism used elsewhere in tktk:

**Teacher-invite path:**
1. Teacher enters student email → row created in `invites` (status `pending`) + row in `class_students` (status `invited`).
2. Resend sends magic link scoped to that invite token.
3. Student clicks link → if no `users` row exists, create one (`role = student`) → mark invite `accepted` → `class_students.status = active`.

**Join-code path:**
1. Student enters join code + email.
2. If code resolves to a class, send magic link (no `invites` row needed — this path doesn't require pre-invitation).
3. On verification: create `users` row if needed → upsert `class_students` row directly to `active`.

Teachers authenticate the same way (magic link, `role = teacher`), no separate flow.

---

## 5. Route surface (Hono, MVP only)

With React out of the picture, most of these are no longer a JSON API — they're page routes and htmx-fragment routes rendered server-side with Hono JSX. A route typically does one of three things: render a full page, render a partial for an htmx swap (`hx-target`), or handle a form POST and respond with the updated fragment (the htmx pattern, not a redirect-then-refetch).

```
GET    /auth/login                   -> login page (email form)
POST   /auth/magic-link              { email }           -> "check your email" fragment
GET    /auth/callback                ?token=...           -> verifies, sets session, redirects

GET    /classes                      -> teacher's class list page
POST   /classes                      { name, description?, term? }   -> renders new class-list-item fragment  [teacher]
GET    /classes/:id                  -> class detail page (roster, teachers)
POST   /classes/:id/teachers         { email }   -> add co-teacher, returns updated teacher-list fragment
POST   /classes/:id/invites          { email }   -> invite student, returns updated roster-row fragment (status: invited)
GET    /join                         -> join-by-code page (join-code + email form)
POST   /join                         { joinCode, email }   -> "check your email" fragment or error fragment
GET    /classes/:id/roster           -> roster partial (used for htmx polling/refresh if needed)
DELETE /classes/:id/students/:userId -> removes student, returns empty response for hx-swap="delete"  [teacher]
```

Keep route handlers thin; business logic in a `src/lib/classes.ts`-style module, all DB access still funneled through `src/db.ts`. JSX components live in `src/views/` (e.g. `ClassList.tsx`, `RosterRow.tsx`) and are pure render functions — no client-side state, all interactivity via `hx-*` attributes.

---

## 6. Infra & deployment (Cloudflare, diverging from MMC's DO setup)

| Concern | MMC (DO) | tktk (this MVP) |
|---|---|---|
| Compute | Droplet | Cloudflare Workers (Hono) |
| DB | — | D1 via Drizzle |
| Frontend | — | Server-rendered Hono JSX + htmx 4.0 — no client build step, no bundler-managed frontend app |
| Environments | prod + persistent staging.mysterymixclub.com | **prod Workers + preview deployments per PR, no persistent staging** (per decision — simpler footprint for MVP) |
| Email | — | Resend |

**htmx version note:** building against **htmx 4.0** per decision (see `htmx-4.0-notes.md` for what's actually different from 2.x and why that matters for how we write server responses). 4.0 is not GA — it ships under the `next` npm tag, with 2.x remaining `latest` until roughly early 2027. Pin the CDN/npm version explicitly; don't use an unversioned CDN URL, since 4.0 isn't the default and an unpinned reference could silently resolve to 2.x or vice versa later.

Preview deployments should get their own D1 database binding (or a seeded/branch DB) so PR review doesn't touch prod data. Worth confirming Cloudflare's current preview-DB story before scaffolding — flag this as a setup question for whoever scaffolds, don't assume.

---

## 7. CI/CD & tooling

Mirror MMC's conventions:
- Husky + commitlint, Conventional Commits
- GitHub Actions: lint/typecheck/test on PR, deploy preview on PR, deploy prod on merge to main
- No persistent staging step in the pipeline (per decision above) — PR preview *is* the pre-prod check.

---

## 8. Agentic dev workflow

- Issue tracking: **beads (`bd`)**, same as MMC — local, part of the Claude Code agentic loop, not a general planning tool.
- Subagents: all five ported from MMC — `developer`, `tester`, `reviewer`, `ui-agent`, `product-manager`. See `/agents/*.md` for tktk-specific definitions.
- `CLAUDE.md` at repo root carries the base guidelines (stack conventions, `src/db.ts` rule, schema portability rule, this MVP's scope boundaries so agents don't wander into assignments/submissions work).

---

## 9. Open questions to settle before/during scaffolding

1. Preview-deployment D1 binding strategy (seeded copy vs. shared branch DB vs. ephemeral).
2. Join-code collision/regeneration policy (retry on collision, allow teacher to regenerate?).
3. Can a `users` row ever hold both `teacher` and `student` roles (e.g., a TA)? MVP assumes no — flag if that's wrong.
4. Invite token expiry window (24h? 7 days?) — not yet decided, pick a default and document it in `CLAUDE.md` once chosen.
5. CSS approach for the htmx frontend (plain stylesheet vs. utility framework) — not yet decided; see `agents/ui-agent.md`.
6. htmx 4.0 is pre-GA — track upstream beta churn until it reaches GA (~early 2027 per the announcement); don't treat this migration as a one-time task.

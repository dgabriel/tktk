# CLAUDE.md — tktk

Base guidelines for any agent (subagent or interactive) working in this repo. Read this before touching code.

## What tktk is (this milestone)

A class + roster management MVP for a writing-workshop mini-LMS. **This milestone is scope-limited to classes and rosters.** Do not scaffold assignments, submissions, feedback, grading, or peer-review features, even if they seem like natural next steps — that's deliberately deferred. If a task seems to require one of those, stop and flag it rather than building around it.

The repo also contains `prototype/` — an earlier React+Vite feedback-annotation prototype for the fuller workshop-LMS vision (unrelated stack, unrelated beads epic `tktk-seb`). It's kept for reference only. Nothing in this milestone builds on it, imports from it, or shares tooling with it.

## Stack

- **Runtime:** Cloudflare Workers
- **API framework:** Hono
- **DB:** D1, accessed exclusively via Drizzle ORM
- **Frontend:** Server-rendered Hono JSX + htmx 4.0 — no React, no client build step, no bundler-managed frontend app. See `htmx-4.0-notes.md` for version-specific behavior (explicit `:inherited` attribute inheritance, renamed events, `fetch()`-based transport).
- **Auth:** username + password (PBKDF2 via Web Crypto, `src/lib/password.ts`), no email confirmation yet. Supersedes kickoff brief §4's magic-link design — see "Decisions made during scaffolding." Resend is still used for invite delivery (notification), just not for authentication.
- **Issue tracking:** beads (`bd` CLI) — local to the agentic dev loop, not a general planner

## Hard rules

1. **All database access goes through `src/db.ts`.** No agent creates a second DB client, a second connection pool, or queries D1 directly from a route handler. If `src/db.ts` doesn't expose what you need, extend it — don't route around it.
2. **Schema is written Postgres-compatible**, even though this runs on D1/SQLite today. This is a portability commitment, not a style preference — don't use SQLite-only types or syntax in the Drizzle schema.
3. **Keep route handlers thin.** Business logic belongs in `src/lib/`, not inline in Hono route definitions. JSX views belong in `src/views/` as pure render functions — no client-side state or effects; all interactivity is `hx-*` attributes.
3a. **Every route reachable via `hx-push-url` must branch on the `HX-Request` header** (full-page render vs. fragment). See `htmx-4.0-notes.md` — this is a correctness requirement in 4.0, not a nice-to-have, because of how history navigation works now.
4. **No persistent staging environment.** Prod + PR preview deployments only. Don't add a `staging.*` deploy target or assume one exists.
5. **Multi-teacher is a first-class case, not an edge case.** Any roster/class query should assume a class may have more than one teacher; don't write queries that assume a single `owner`.

## Agentic workflow

- Work is tracked in beads (`bd`), not GitHub Issues or any external tracker.
- Subagent roles (see `.claude/agents/`): `product-manager`, `developer`, `tester`, `reviewer`, `ui-agent`. Route work to the matching subagent rather than doing cross-cutting work in one shot.
- Conventional Commits, enforced via commitlint/Husky. PRs trigger lint/typecheck/test + preview deploy; merge to `main` deploys prod. PRs also get a non-blocking Flaught adversarial-review pass (see "CI adversarial review" below).

## CI adversarial review (Flaught)

- `@flaught/core` runs as its own CI job (`flaught` in `.github/workflows/ci.yml`), pinned to an exact version — never an unpinned install, so a newly published version can't start running in CI unreviewed.
- **Provider: Groq, not Anthropic.** Claude authors most of this repo's code, so reviewing with an Anthropic model would reproduce the self-review blind spot Flaught exists to catch. This mirrors the same call made in the MMC project for the same reason — don't change the provider without re-litigating that rationale.
- **Non-blocking.** The job never exits 1; findings surface via a PR comment and an uploaded `findings.json` artifact, not a merge gate. Revisit only with a deliberate decision (and its own note here), not silently.
- Requires a `GROQ_API_KEY` repository secret — not yet provisioned in this repo as of scaffolding; the job will run but produce no LLM findings until it's added.
- Config lives in `.advreview.yml`, left as Flaught's own generated defaults except `tools.linter.command: oxlint` (tktk uses oxlint, not the auto-detected eslint) — don't hand-edit the rest without a reason; a prior MMC incident (see MMC's ADR 0018) traced real gaps back to ad hoc, piecemeal config drift rather than the tool itself.

## Design language

tktk does not inherit MMC's Duchamp/Rotorelief visual system — that's MMC-specific. Direction chosen for this MVP (tktk-lfc.7):

- **Palette:** warm paper-and-ink. Background `--color-paper` (`#faf6ef`) with a slightly deeper `--color-paper-alt` (`#f1ece1`) for panels/cards; text in near-black `--color-ink` (`#211d17`) with a muted warm-gray `--color-ink-soft` (`#5c5346`) for secondary text; borders/dividers in `--color-line` (`#ddd4c4`). One accent color, a deep ink-blue `--color-accent` (`#2f4858`), used for links, primary buttons, and focus states — deliberately not a color MMC's Cream/Sage/Rust palette already uses. `--color-danger`/`--color-success` (with matching `-bg` tints) round out the set for form errors and confirmation messages (invite sent, etc.). All defined as CSS custom properties in `public/styles.css` `:root`.
- **Type:** a serif/sans pairing from the same type-designer superfamily — `Source Serif 4` for headings/legends (literary tone, fits a writing-workshop tool) and `Source Sans 3` for body text and form UI (legible at small sizes, works well in dense forms/tables). **Self-hosted, not a live Google Fonts `@import`** — an `@import` there means every visitor's browser makes a direct, IP-bearing request to Google on every page load, a real privacy concern (raised as a Flaught finding, decided 2026-08-29: self-host over accepting the exposure or dropping to system fonts only). The two `.woff2` files in `public/fonts/` are each the variable-font "latin" subset Google serves under the hood (`wght` 200–900 on both; Source Serif 4 also has an `opsz` 8–60 axis, left to the browser's default rather than pinned) — one file per family, no build step needed since Workers serves them as static assets the same way as `styles.css` itself. System-font fallback stacks (`--font-serif`, `--font-sans`) still apply if a font file fails to load.
- **CSS approach:** plain stylesheet (`public/styles.css`), not a utility framework. Justification against the "no client build step" constraint: Tailwind needs either a build step (not present here — no bundler-managed frontend app) or its CDN/play-CDN runtime script, which is an extra external dependency and runtime cost this MVP doesn't need for a form-and-table-heavy, mostly-static UI. A plain stylesheet with custom-property tokens gives route-level JSX views a consistent, shared vocabulary (color/type/spacing tokens, base element styles for forms/buttons/tables) without either cost.
- **Layout:** mobile-first (base rules target small screens; `min-width` media queries add room, not the reverse) — Cloudflare Workers apps like this commonly get checked from a phone. `.container`/`.container-narrow` set max-widths for wide (roster/class-list) vs. narrow (auth/invite forms) screens; a small spacing scale (`--space-1`..`--space-8`) and a `.stack` vertical-rhythm utility are the only layout primitives — kept minimal on purpose, no full utility-class system.
- **Explicitly not doing:** no dark mode / theme toggle (out of scope for this MVP, no JS-driven theming needed); no component-specific styles for screens that don't exist yet (login, class-list, roster views etc. are `ui-agent`/`developer` work under tktk-lfc.1/tktk-lfc.2) — `public/styles.css` covers only the base system (reset, typography, color tokens, form controls, buttons, tables, layout primitives) those screens will draw on.

## Decisions made during scaffolding

These resolve gaps in the kickoff brief that blocked scaffolding a working skeleton. They're conservative defaults, not final product decisions — reopen with `product-manager`/the user if they're wrong, don't just work around them.

- **Auth is username + password, not magic-link (supersedes kickoff brief §4).** The magic-link round-trip (check email, click link, get redirected) was a poor login UX for repeat visits — decided after scaffolding, not part of the original brief. `users` gained `username` (unique, the login identifier) and `passwordHash` (PBKDF2-SHA256 via Web Crypto, `src/lib/password.ts` — 210k iterations per OWASP's 2023 minimum, no bcrypt/argon2 dependency since Workers' `SubtleCrypto` doesn't expose them natively). **No email confirmation yet** — a user's `email` is collected (still needed for invite matching/contact) but not verified via a clicked link; add that later if needed, don't build around its absence. The `login_tokens` table from the original scaffolding pass is **removed** — it existed only to back magic-link login. `invites.token` is now an invite/enrollment code (the emailed link takes a student to a signup form), not an auth token — Resend is still used for invite *delivery*, just not for login/signup.
- **Sessions are stateless, signed cookies** (`src/lib/session.ts`), not a DB-backed session table and not Workers KV. Keeps the MVP on a single Cloudflare resource (D1) instead of introducing a second one. Needs a `SESSION_SECRET` (see `.dev.vars.example`).
- **Invite-code expiry: 7 days.** (Kickoff brief §9.4 asked for a default to be picked and documented — this is it. Applies to `invites.expires_at`; there's no login-token expiry anymore since there's no login token.)
- **Join-code collisions:** generate, retry on unique-constraint violation. No regeneration endpoint yet (not in kickoff brief §5's route list) — flag to `product-manager` if teachers need to rotate a compromised code.
- **CSS approach and visual design direction:** resolved by `ui-agent` per kickoff brief §9.5 — see "Design language" above. `public/styles.css` now carries the real base stylesheet.
- **D1 preview-deployment binding strategy (kickoff brief §9.1) is still open** — needs a Cloudflare account decision (seeded copy vs. shared branch DB vs. ephemeral) that couldn't be made without real Cloudflare access during scaffolding.
- **Password minimum: 8 characters** (`MIN_PASSWORD_LENGTH` in `src/lib/auth.ts`), no other complexity rules. Nothing in the kickoff brief specified a password policy; this is a conservative MVP default, not a final product decision — revisit with `product-manager` if a stricter policy is wanted.
- **`GET`/`POST /auth/signup` is teacher self-registration only** (hardcodes `role: 'teacher'`) — there is no public student signup route. Students only get accounts via the invite-acceptance flow (tktk-lfc.4) or the join-code flow (tktk-lfc.5); both are separate, not-yet-built issues with their own signup-like logic reusing `src/lib/password.ts`. Not in the original kickoff brief (which had no explicit signup step at all, since magic-link didn't need one).
- **Duplicate-invite handling (tktk-lfc.4, not specified anywhere):** a second *pending* invite to the same class+email is rejected with a clear error rather than creating a second row; expired/revoked/accepted invites don't block a fresh one. Also rejected: inviting an email that already belongs to a class member (invited or active) of that class, so a re-invite after acceptance can't silently create an orphaned second membership. See `src/lib/invites.ts` `createInvite`.
- **`class_students.user_id` is NOT NULL and FK'd to `users.id`, enforced eagerly per-statement by D1** (confirmed against local `wrangler dev` — `db.batch()` does not defer FK checks to commit). This is a gap the kickoff brief's schema didn't anticipate: an invited student has no `users` row until they sign up at acceptance, but invite creation needs to write a `class_students` row atomically with the invite (same `db.batch()` pattern as `createClass`). Resolved by inserting an actual placeholder `users` row (unusable username/password-hash, a `*.invalid` email so it can never collide with a real signup or be mistaken for one) in the same batch, using the invite's own id as the placeholder's id; `acceptInvite` then `UPDATE`s that row in place at signup instead of inserting a second one. See the module-level comment in `src/lib/invites.ts` for the full reasoning, including the already-has-an-account cleanup path (`attachInviteToExistingUser` repoints `class_students` at the real user and deletes the now-unreferenced placeholder). Known gap: an invite that expires or is revoked without being accepted leaves its placeholder `users`/`class_students` rows behind, inert but not currently displayed anywhere — flag to `product-manager` if a cleanup job is wanted.
- **Invite email dev-mode fallback (tktk-lfc.4):** `RESEND_API_KEY` isn't provisioned yet (still the `.dev.vars.example` placeholder). `src/lib/email.ts`'s `sendInviteEmail` detects that and logs the invite link to the console (`[dev] invite link for <email>: <link>`) instead of calling Resend, so the invite flow works end-to-end without a real account. The real Resend call path is fully wired for when a key is provisioned.

## Open decisions not yet made

See §9 of the MVP kickoff brief (`00-tktk-mvp-kickoff-brief.md`) for the full list; the items resolved above are marked as such. Don't silently resolve the rest — surface them.

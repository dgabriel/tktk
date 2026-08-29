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

tktk does not inherit MMC's Duchamp/Rotorelief visual system — that's MMC-specific. If no tktk design direction exists yet, `ui-agent` should propose one rather than defaulting to MMC's palette/type choices, and should flag that this needs a decision rather than picking silently.

## Decisions made during scaffolding

These resolve gaps in the kickoff brief that blocked scaffolding a working skeleton. They're conservative defaults, not final product decisions — reopen with `product-manager`/the user if they're wrong, don't just work around them.

- **Auth is username + password, not magic-link (supersedes kickoff brief §4).** The magic-link round-trip (check email, click link, get redirected) was a poor login UX for repeat visits — decided after scaffolding, not part of the original brief. `users` gained `username` (unique, the login identifier) and `passwordHash` (PBKDF2-SHA256 via Web Crypto, `src/lib/password.ts` — 210k iterations per OWASP's 2023 minimum, no bcrypt/argon2 dependency since Workers' `SubtleCrypto` doesn't expose them natively). **No email confirmation yet** — a user's `email` is collected (still needed for invite matching/contact) but not verified via a clicked link; add that later if needed, don't build around its absence. The `login_tokens` table from the original scaffolding pass is **removed** — it existed only to back magic-link login. `invites.token` is now an invite/enrollment code (the emailed link takes a student to a signup form), not an auth token — Resend is still used for invite *delivery*, just not for login/signup.
- **Sessions are stateless, signed cookies** (`src/lib/session.ts`), not a DB-backed session table and not Workers KV. Keeps the MVP on a single Cloudflare resource (D1) instead of introducing a second one. Needs a `SESSION_SECRET` (see `.dev.vars.example`).
- **Invite-code expiry: 7 days.** (Kickoff brief §9.4 asked for a default to be picked and documented — this is it. Applies to `invites.expires_at`; there's no login-token expiry anymore since there's no login token.)
- **Join-code collisions:** generate, retry on unique-constraint violation. No regeneration endpoint yet (not in kickoff brief §5's route list) — flag to `product-manager` if teachers need to rotate a compromised code.
- **CSS approach and visual design direction are still undecided** — `ui-agent`'s call per kickoff brief §9.5, not resolved by this scaffolding pass. `src/styles.css` is an empty placeholder.
- **D1 preview-deployment binding strategy (kickoff brief §9.1) is still open** — needs a Cloudflare account decision (seeded copy vs. shared branch DB vs. ephemeral) that couldn't be made without real Cloudflare access during scaffolding.

## Open decisions not yet made

See §9 of the MVP kickoff brief (`00-tktk-mvp-kickoff-brief.md`) for the full list; the items resolved above are marked as such. Don't silently resolve the rest — surface them.

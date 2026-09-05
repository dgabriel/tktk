# CLAUDE.md — tktk

Base guidelines for any agent (subagent or interactive) working in this repo. Read this before touching code.

## What tktk is (this milestone)

A class + roster management MVP for a writing-workshop mini-LMS. **This milestone is scope-limited to class administration and rosters.** Do not scaffold assignments, submissions, feedback, grading, or peer-review features, even if they seem like natural next steps — that's deliberately deferred. If a task seems to require one of those, stop and flag it rather than building around it.

Scope for this milestone includes: admins creating classes and assigning instructors, schedule-only class sessions (open/close, no content), and the class lifecycle (active → read-only → archived) that follows from session state. See `docs/specs/` for the full spec set.

## Stack

- **Runtime:** Cloudflare Workers
- **API framework:** Hono
- **DB:** D1, accessed exclusively via Drizzle ORM
- **Frontend:** Server-rendered Hono JSX + htmx 4.0 — no React, no client build step, no bundler-managed frontend app. See `htmx-4.0-notes.md` for version-specific behavior (explicit `:inherited` attribute inheritance, renamed events, `fetch()`-based transport).
- **Auth/email:** Resend (magic link)
- **Issue tracking:** beads (`bd` CLI) — local to the agentic dev loop, not a general planner

## Hard rules

1. **All database access goes through `src/db.ts`.** No agent creates a second DB client, a second connection pool, or queries D1 directly from a route handler. If `src/db.ts` doesn't expose what you need, extend it — don't route around it.
2. **Schema is written Postgres-compatible**, even though this runs on D1/SQLite today. This is a portability commitment, not a style preference — don't use SQLite-only types or syntax in the Drizzle schema.
3. **Keep route handlers thin.** Business logic belongs in `src/lib/`, not inline in Hono route definitions. JSX views belong in `src/views/` as pure render functions — no client-side state or effects; all interactivity is `hx-*` attributes.
3a. **Every route reachable via `hx-push-url` must branch on the `HX-Request` header** (full-page render vs. fragment). See `htmx-4.0-notes.md` — this is a correctness requirement in 4.0, not a nice-to-have, because of how history navigation works now.
4. **No persistent staging environment.** Prod + PR preview deployments only. Don't add a `staging.*` deploy target or assume one exists.
5. **Multi-instructor is a first-class case, not an edge case.** Any roster/class query should assume a class may have more than one instructor; don't write queries that assume a single `owner`.
6. **Roles are capabilities, not identity.** A user can hold the `admin` capability and/or be an instructor and/or a student, across different classes, all at once. The one hard constraint: a user can never be both instructor and student **on the same class**. Don't write a query or view that assumes a user has exactly one role — check `admin_grants` and the relevant per-class membership table instead.

## Agentic workflow

- Work is tracked in beads (`bd`), not GitHub Issues or any external tracker.
- Subagent roles (see `/agents/`): `product-manager`, `developer`, `tester`, `reviewer`, `ui-agent`. Route work to the matching subagent rather than doing cross-cutting work in one shot.
- Conventional Commits, enforced via commitlint/Husky. PRs trigger lint/typecheck/test + preview deploy; merge to `main` deploys prod.

## Design language

tktk does not inherit MMC's Duchamp/Rotorelief visual system — that's MMC-specific. If no tktk design direction exists yet, `ui-agent` should propose one rather than defaulting to MMC's palette/type choices, and should flag that this needs a decision rather than picking silently.

## Open decisions not yet made

Full detail lives in `docs/specs/technical-spec.md` (which supersedes kickoff brief §9 —
its resolutions are noted inline section by section). Don't silently resolve any of these —
surface them. Currently blocking, awaiting your input:

- **Preview-deployment D1 binding strategy** (`technical-spec.md` §4) — depends on your
  Cloudflare account/plan specifics; not defaulted.
- **Read-only vs. last-session-closed gate tension** (`technical-spec.md` §10, `docs/specs/user-stories.md` S9.1) — "read-only" triggers when the final session *opens*; the invite/join lockout triggers when it *closes*. A class can currently be read-only while still technically open to new invites. No default has been picked — deliberately left as-is per your instruction (2026-09-05) not to resolve it yet, just to keep it visible.
- **Derived (read-time) lifecycle state vs. a real scheduled-job event** (`technical-spec.md` §9-10) — session/class open state is computed on read, with no cron trigger and no discrete "it just opened" event. Fine for display; not sufficient if you ever need that moment to be a real auditable event, or once the deferred welcome-email feature is built (which does need a real point-in-time trigger). Also left open per your instruction (2026-09-05).


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:6cd5cc61 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->

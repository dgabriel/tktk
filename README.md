# tktk

A class + roster management MVP for a writing-workshop mini-LMS, built for a poetry instructor at Brooklyn Poets. This is the current milestone; an earlier, unrelated prototype (feedback/annotation on submitted work, a different stack entirely) lives in `prototype/` for reference — see its own `README.md` and `CLAUDE.md`.

**Stack:** Cloudflare Workers + Hono + D1 (Drizzle ORM) + server-rendered Hono JSX + htmx 4.0. No React, no client build step. Username/password auth; Resend for invite delivery.

Full architecture, conventions, and the decisions made along the way live in [`CLAUDE.md`](./CLAUDE.md) — read that before making changes. Original scope/data-model spec: [`00-tktk-mvp-kickoff-brief.md`](./00-tktk-mvp-kickoff-brief.md) (see its note on what's changed since).

## Develop

```bash
npm install
cp .dev.vars.example .dev.vars   # fill in a real SESSION_SECRET; RESEND_API_KEY can stay a placeholder (invite emails log to the console instead)
npm run db:migrate:local         # applies drizzle/*.sql to a local D1 emulation (no Cloudflare account needed), then seeds a fixed test account
npm run dev                      # wrangler dev, http://localhost:8787
```

Log in with `teacher@tktk.test` / `password123` (seeded by `db:seed:local`, chained onto `db:migrate:local` above — see `scripts/seed-local.ts`). Re-running either command is safe; it just refreshes that one row rather than duplicating it, so the account survives the local-D1 wipes that schema changes tend to require.

## Develop in Docker (recommended if the dev server keeps getting killed out from under you)

```bash
docker compose up -d --build   # first time, or after a Dockerfile/dependency change
```

That's it — leave it running. `wrangler dev` runs inside the container and watches the bind-mounted source tree, so editing files on the host hot-reloads the running Worker in place (see log line `⎔ Reloading local server...`); you never need to restart or rebuild for a routine code change. `docker compose down` only when you're done for the session; `docker compose logs -f` to tail it. `.dev.vars` is read the same way as native `npm run dev`, and local D1 state (`.wrangler/`) persists across restarts since it's on the bind-mounted host filesystem, not inside the container.

## Other commands

```bash
npm run typecheck   # tsc --noEmit
npm run lint         # oxlint
npm run db:generate  # regenerate drizzle/*.sql after a schema change
npm run deploy        # wrangler deploy (needs a real Cloudflare account/D1 database first — see wrangler.jsonc)
```

## Issue tracking

Work is tracked in [beads](https://github.com/gastownhall/beads) (`bd`), not GitHub Issues — `bd ready` to see what's unblocked, `bd show <id>` for details. See `CLAUDE.md` for the subagent workflow (`product-manager` → `developer` → `tester` → `reviewer` → `ui-agent`, defined in `.claude/agents/`).

## CI / code review

GitHub Actions runs lint/typecheck on PRs and deploys previews/prod (`.github/workflows/`). Every commit also goes through a local [Flaught](https://github.com/flaught/core) adversarial-review gate (`.husky/pre-commit`) — deterministic checks always, a full LLM pass when `GROQ_API_KEY` is set locally. See `CLAUDE.md` "CI adversarial review" for how CI's (non-blocking) and the local gate's (blocking) policies differ.

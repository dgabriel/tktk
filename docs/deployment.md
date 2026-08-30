# Deployment — setup runbook

Nothing in this checklist has been done yet as of 2026-08-30. Local development works fully without any of it (see `README.md`) — this is what's needed to actually deploy tktk to Cloudflare and wire up CI. Follow in order; later steps depend on earlier ones.

## 1. Cloudflare account access

```bash
npx wrangler login
```

Everything below assumes this succeeded and you're authenticated against the Cloudflare account tktk should deploy to.

## 2. Create the D1 database

```bash
npx wrangler d1 create tktk
```

This prints a `database_id`. Paste it into `wrangler.jsonc`'s `d1_databases[0].database_id`, replacing the `REPLACE_WITH_REAL_D1_DATABASE_ID` placeholder. Commit that change.

Apply the schema to the real (remote) database — note the `--remote` flag, different from the `--local` command used for day-to-day dev:

```bash
npx wrangler d1 migrations apply DB --remote
```

Re-run this (still `--remote`) after every future `npm run db:generate` that produces a new migration file, same as you'd run `npm run db:migrate:local` for local dev.

## 3. Set Worker secrets (production)

Two secrets, set directly against the deployed Worker (not `.dev.vars`, which is local-only and gitignored):

```bash
npx wrangler secret put SESSION_SECRET
# paste a long random value, e.g. from `openssl rand -base64 32`

npx wrangler secret put RESEND_API_KEY
# paste a real Resend API key (see step 5) -- until this is a real key,
# src/lib/email.ts logs invite links to the Worker's console instead of
# sending real email; see CLAUDE.md "Decisions made during scaffolding"
```

## 4. GitHub Actions secrets

Repo Settings → Secrets and variables → Actions. Three secrets, used by `.github/workflows/`:

| Secret | Used by | Where to get it |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | `deploy.yml` (preview + prod deploys) | Cloudflare dashboard → My Profile → API Tokens → create one scoped to Workers/D1 edit for this account |
| `CLOUDFLARE_ACCOUNT_ID` | `deploy.yml` | Cloudflare dashboard sidebar, or `npx wrangler whoami` |
| `GROQ_API_KEY` | `ci.yml` (the `flaught` job's LLM pass) | [console.groq.com/keys](https://console.groq.com/keys) — free tier. Without this, the CI Flaught job still runs deterministic checks only; see CLAUDE.md "CI adversarial review" |

Without these, `deploy.yml` will fail at the `cloudflare/wrangler-action` step and `ci.yml`'s `flaught` job will silently skip the LLM pass (it degrades gracefully, per Flaught's own design — not a hard failure).

## 5. Resend (invite email delivery)

1. Create a Resend account, verify a sending domain.
2. Update `FROM_ADDRESS` in `src/lib/email.ts` — currently a placeholder (`tktk <invites@tktk.dev>`) that **will not send** until it matches a domain actually verified in your Resend account.
3. Set the real API key as both the `RESEND_API_KEY` Worker secret (step 3) and, if you want CI to exercise real sends, a GitHub Actions secret (not currently referenced by any workflow — only relevant if that changes).

Until this step is done, invite emails just log to the Worker's console (`[dev] invite link for <email>: <link>`) — the rest of the invite flow (tktk-lfc.4) works fine without it, teachers just need to grab the link from logs (locally) or `wrangler tail` (deployed) to test it manually.

## 6. First deploy

```bash
npm run deploy
```

Or push to `main` / open a PR once GitHub Actions secrets (step 4) are set — `deploy.yml` handles it from there (prod on push to `main`, a preview on PRs).

## Known gap: preview-deployment database isolation

**Not resolved yet** (CLAUDE.md, kickoff brief §9.1). `deploy.yml`'s PR-preview job deploys the Worker itself but does **not** provision a separate D1 database or binding for it — a PR preview currently reads/writes the same production D1 database. This needs a decision (seeded copy per PR vs. a shared branch database vs. an ephemeral one) before preview deploys are safe to actually use for review; don't treat a green preview deploy as isolated-from-prod until this is addressed.

## Quick reference: what's real vs. placeholder right now

| Thing | State |
|---|---|
| D1 database | Placeholder id in `wrangler.jsonc` — step 2 |
| `SESSION_SECRET` (prod) | Not set — step 3 |
| `RESEND_API_KEY` (prod) | Not set — step 3, dev-mode console fallback works without it |
| `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` (CI) | Not set — step 4, `deploy.yml` will fail without them |
| `GROQ_API_KEY` (CI) | Not set — step 4, `flaught` CI job degrades gracefully without it |
| Resend sending domain | Not set up — step 5, placeholder `FROM_ADDRESS` won't actually deliver |
| Preview DB isolation | Not designed — see "Known gap" above |

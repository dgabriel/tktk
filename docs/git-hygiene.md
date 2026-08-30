# Git Hygiene — Non-Negotiable

Read this at the start of **every** task that may touch git. The goal is a clean,
legible history and a working tree that is never in a "weird state." When in doubt,
stop and ask — do not improvise your way out of a git mess.

Adapted from the MysteryMixClub project's `docs/git-hygiene.md`. tktk's branch model
is simpler than MMC's: **there is no `develop`/staging branch** (CLAUDE.md rule 4 —
prod + PR preview deployments only). Every rule below that assumed a two-branch
promotion flow has been rewritten for tktk's single `main` + feature-branch model;
sections that don't apply here (the squash-merge-across-two-branches trap, the
`develop`→`main` promotion ritual) are dropped rather than kept as dead weight.

---

## The Golden Rules

1. **Know where you are before you do anything.** Run `git status` and
   `git branch --show-current` before you start and before every commit. Never
   assume the branch or the working-tree state.
2. **Never commit directly to `main`.** All work happens on a `feature/*` (or
   `fix/*`) branch and reaches `main` only through a PR.
3. **Every branch is based off `main` — no exceptions.** Cut every `feature/*`
   or `fix/*` branch from an **up-to-date** `main`. Never branch off another
   feature branch (stacked branches drift and are how merges silently drop code).
   Always pull first so you start from the latest:
   ```
   git checkout main && git pull --ff-only origin main
   git checkout -b feature/tktk-<bd-id>-short-slug
   ```
   (`scripts/bead-start.sh <bd-id>` does exactly this — sync, branch, claim —
   in one step; use it instead of the manual sequence above when starting
   work on a bd issue.)
   If a branch ends up based on anything other than current `main`, rebase it
   onto `main` before continuing (`git rebase origin/main`).
   **Create the branch before writing a single line of code.** Never edit files
   on `main` and branch after — you will end up with uncommitted changes on a
   shared branch. Branch first, then code.
   **Start from origin state, not local state.** PRs may get merged from the
   GitHub web UI. Before trusting any local branch, always:
   ```
   git fetch --prune
   ```
   Then prune local branches whose upstream is gone (`git branch -vv | grep
   ': gone]'`) — each one either merged already (safe to delete) or needs a
   look before deleting, never silently kept around as if still live.
4. **One branch at a time.** Finish and merge the current branch before starting
   the next piece of work. Do not begin new feature code while a PR is open and
   unmerged — even if asked. Stack depth = 1.
5. **bd issues and git branches are separate axes — don't conflate them.** Issue
   state lives in bd's own Dolt store, synced via `refs/dolt/data` — a ref
   namespace alongside but independent of `refs/heads/*`. Checking out a
   different git branch does not change which bd issues exist or their status.
   - **Don't adopt bd's own Dolt-native branching** (`bd branch`) as a
     per-feature-branch mirror of git branches. At this project's scale it only
     adds a second merge-conflict surface for no payoff. One shared bd history
     is enough.
   - **Sequence `bd dolt push` after the PR merges and the issue closes, not
     before.** Issue state and code state sync independently, so pushing dolt
     state ahead of the actual merge would let a collaborator pull a "closed"
     issue whose code isn't in `main` yet.
6. **Never force-push a shared branch** (`main`, or any branch with an open PR
   / other readers). `--force-with-lease` only ever on your own private
   feature branch, and only when you understand why.
7. **Never rewrite published history.** Don't `rebase`, `amend`, or `reset`
   commits that have already been pushed to a shared branch. Amend only local,
   unpushed commits.

---

## Commits

- **One logical change per commit.** No "misc fixes" grab-bags; no unrelated files
  riding along. Check `git diff --staged` before committing.
- **Conventional Commits**, enforced by commitlint: `type(scope): subject`
  (`feat`, `fix`, `chore`, `docs`, `refactor`, `test`, …). Imperative subject,
  no trailing period.
- **Non-chore/docs/ci/style/build/revert commits need a `Bead: <id>` trailer**,
  enforced by `.husky/commit-msg` (`scripts/check_bead_trailer.py`) — e.g.:
  ```
  Bead: tktk-lfc.3
  ```
  so git history and the bd issue graph join exactly. `scripts/bead-start.sh
  <id>` gives you the id to use; don't hand-pick one from memory.
- **End commit messages with the Claude co-author trailer**, naming whichever
  model is actually running the session — e.g.:
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  ```
  Don't pin a specific model name here as a hardcoded example to copy
  verbatim; it'll go stale the next time the underlying model changes.
- **Only commit/push when the user asks** (or under a standing autonomy grant
  explicitly given for that scope of work). Flag risky changes even then.
- **Stage intentionally.** Prefer naming paths over `git add -A`. Never commit
  secrets, `.env`, `.dev.vars`, build artifacts, or scratch files — check
  `git status` first.
- **Never use `git commit --no-verify`** to skip hooks. If a hook fails, fix the
  cause.

---

## Working Tree — staying out of weird states

- **Keep the tree clean.** Don't start new work on top of unrelated uncommitted
  changes. Commit, stash, or discard first — deliberately.
- **`git stash` is not a parking lot.** If you stash, pop it back in the same
  session; a forgotten stash is a future "where did my change go."
- **Never leave a detached HEAD.** If `git status` says "HEAD detached," stop and
  get back onto a named branch before doing anything else.
- **Resolve conflicts, never paper over them.** During a merge/rebase conflict,
  resolve every marker, re-run the relevant checks, then continue. If it's beyond
  a clean resolution, `git merge --abort` / `git rebase --abort` and reassess —
  do not force a half-merged tree.
- **Destructive commands need confirmation.** `git reset --hard`, `git clean -fd`,
  branch deletion, and force-push can lose work irrecoverably. State what will be
  lost and confirm before running them.
- **Recover, don't panic.** `git reflog` finds "lost" commits after a bad
  reset/rebase. Reach for it before recreating work.

---

## Pull Requests

- Feature branch → PR into `main`; CI (lint/typecheck, and test once a suite
  exists) must be green before merge. See `.github/workflows/ci.yml` and
  CLAUDE.md "CI adversarial review" for how Flaught's PR-comment job fits in
  (non-blocking — it's a signal, not a gate).
- Keep the branch current with `git pull --rebase` (your own branch) or a merge
  from `main`; don't let it drift far behind.
- **Merge promptly.** Once CI is green, merge. Open PRs drift from `main` and
  compound conflict risk for every other branch in flight.
- Squash-merge is fine for feature/fix PRs into `main` — there's no second
  branch downstream of `main` to strand an ancestor link for (unlike MMC's
  `develop`→`main` promotion setup, where squashing broke `git merge-base`
  across repeated promotions). If that ever changes (a staging branch gets
  added later), revisit this line before assuming squash is still safe.

---

## Pre-flight before pushing (catch CI failures locally)

- `.husky/pre-push` runs typecheck and lint before every push (test suite once
  one exists) — let it. Don't bypass with `--no-verify`.
- `.husky/pre-commit` also runs a **blocking** local Flaught adversarial-review
  gate — separate from CI's non-blocking one. See CLAUDE.md "CI adversarial
  review" for why the two have different blocking policies, and never
  `flaught dismiss` a finding yourself as an agent — that's a human call
  (CLAUDE.md, `.husky/pre-commit`'s own comments).

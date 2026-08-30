# tktk Roadmap

Working doc, updated as issues close. Source of truth is always `bd show tktk-lfc` — this is a human-readable snapshot of it, not a replacement.

Last updated: 2026-08-30

## Where we are

**Class + roster foundation (tktk-lfc epic): 7/7 done, epic eligible for close**

- [x] Design direction (palette, type, CSS approach)
- [x] Auth — signup/login/session
- [x] Class CRUD — create, list, detail
- [x] Invite-by-email flow
- [x] Co-teacher management
- [x] Join-code flow (student self-serve)
- [x] Roster view + student removal

Not yet: testing pass (this milestone has no automated test suite; everything's been verified manually against a real local D1, including one real headless-browser pass for the roster's htmx interaction). Epic itself left open pending that.

## Bigger picture (three phases)

1. **Prototype** (earlier work, separate stack/epic `tktk-seb`, ~90% done) — feedback/annotation tools, lesson editor, readings viewer. Kept in `prototype/` for reference.
2. **Class + roster foundation** (current, this doc) — new stack (Cloudflare/Hono/D1/htmx). The base everything else sits on.
3. **Full workshop platform** (future) — bring phase 1's features onto phase 2's foundation. Not started, not scoped yet.

## Notes / open questions

- Preview-deployment DB isolation not designed yet (see `docs/deployment.md`)
- No test suite yet
- Nothing deployed — local dev only so far

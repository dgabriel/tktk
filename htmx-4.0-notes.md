# htmx 4.0 — build notes for tktk

Reference doc for agents/devs writing Hono routes and JSX views against htmx 4.0. Not a full changelog — just what matters for how tktk's server responses and event hooks are written.

## Status (as of this doc)

- htmx 4.0.0 has shipped, but is **not** the default. On npm, `2.x` remains tagged `latest`; `4.x` is tagged `next` until roughly early 2027.
- **Action:** pin the exact version in `package.json` / CDN URL. Do not use an unversioned CDN `<script>` tag — those resolve to `latest`, which is still 2.x.

## What actually changes (relevant to us)

1. **Transport: `fetch()` instead of `XMLHttpRequest`.**
   Mostly invisible to route handlers — a Hono route returning HTML is a Hono route returning HTML either way. Matters if we ever inspect request internals or stream responses; `fetch()`-based streaming behaves differently than XHR did. Flag if any route needs streaming/SSE-style responses.

2. **Attribute inheritance is explicit by default now**, via an `:inherited` modifier.
   In 2.x, a parent's `hx-target` (etc.) implicitly applied to children. In 4.0, it doesn't unless marked:
   ```html
   <div hx-target:inherited="#roster">
     <button hx-post="/classes/1/invites">Invite</button>
   </div>
   ```
   **Action for `ui-agent`:** don't assume implicit inheritance patterns from htmx 2.x tutorials/examples will work — check every parent/child `hx-*` relationship and add `:inherited` explicitly where needed. This is the biggest source of "worked in the docs example, silently didn't work here" bugs.

3. **Event names are standardized/renamed.**
   `htmx:beforeRequest` → `htmx:before:request`, `htmx:afterSwap` → `htmx:after:swap`, etc. (colon-delimited, consistent casing).
   **Action:** any custom JS listening for htmx lifecycle events (e.g. a small script tied to invite/join flows) must use 4.0 event names. Don't copy event names from 2.x documentation or Stack Overflow answers without checking against 4.0.

4. **History behavior changed.** 4.0 no longer snapshots the DOM into session storage for back/forward — it just re-requests content on history navigation. Simpler, but means any route that can be reached via `hx-push-url` needs to handle being hit as a plain GET on back/forward, not assume it's always an htmx-fragment request. Check `HX-Request` header presence and render full page vs. fragment accordingly.

## What tktk route handlers should do

Every route that can be hit both as a full page load and an htmx-triggered partial swap should branch on the `HX-Request` header:

```ts
// pseudocode pattern
const isHtmxRequest = c.req.header('HX-Request') === 'true'
return isHtmxRequest
  ? c.html(<RosterPartial ... />)
  : c.html(<Layout><RosterPartial ... /></Layout>)
```

This matters more in 4.0 than it did in 2.x specifically because of the history-navigation change in point 4 above — a back-button hit is a real GET, not a cached DOM snapshot, so the route needs to be able to answer it correctly either way.

## Open item

Because 4.0 is pre-GA, watch for further beta churn between whatever beta/RC is current at scaffolding time and the eventual GA. `reviewer` should treat "did htmx's behavior change out from under us" as a standing risk on this project until 4.0 goes GA (~early 2027 per the announcement), not just a one-time migration concern.

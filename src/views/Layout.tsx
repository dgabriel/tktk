// Base HTML shell shared by every full-page render. Pure render function —
// no client-side state, all interactivity via hx-* attributes elsewhere.
//
// htmx pinned to an exact version (4.0.0), per htmx-4.0-notes.md: an
// unversioned CDN <script> tag resolves to `latest`, which is still 2.x
// until htmx 4.0 reaches GA.

import type { FC, PropsWithChildren } from "hono/jsx";

export const Layout: FC<PropsWithChildren<{ title?: string }>> = ({ title, children }) => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title ? `${title} — tktk` : "tktk"}</title>
      <link rel="stylesheet" href="/styles.css" />
      <script src="https://unpkg.com/htmx.org@4.0.0"></script>
    </head>
    <body>{children}</body>
  </html>
);

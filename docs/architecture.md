# Architecture

A human-readable tour of how tktk is built, as of 2026-08-30 (4 of 7 MVP issues complete — see `bd show tktk-lfc`). For conventions and decisions-with-rationale, see `CLAUDE.md`; this document is about *how the pieces fit together*, not why each choice was made.

## 1. System overview

tktk is a single Cloudflare Worker — no separate frontend build, no separate API server. One request handler (Hono) renders server-side HTML (Hono JSX) and reads/writes one D1 database. Static assets (the stylesheet, self-hosted font files) are served directly by Cloudflare's edge, bypassing the Worker entirely.

```mermaid
flowchart LR
    Browser["Browser"]
    Edge["Cloudflare Edge"]
    Worker["Worker (Hono app)\nsrc/index.tsx"]
    D1[("D1 Database\n(SQLite)")]
    Assets["Static Assets\npublic/ (styles.css, fonts)"]
    Resend["Resend API\n(invite email)"]

    Browser -->|HTTP request| Edge
    Edge -->|"/styles.css, /fonts/*"| Assets
    Edge -->|everything else| Worker
    Worker <-->|Drizzle ORM\nsrc/db.ts| D1
    Worker -->|invite emails| Resend
    Assets -.->|served, no Worker code runs| Browser
```

No client-side JavaScript framework runs in the browser. htmx 4.0 is loaded (pinned, self-hosted-adjacent via CDN — see `htmx-4.0-notes.md`) but none of the views built so far actually use `hx-*` attributes; every form is a plain `method="post"` with a full-page redirect. That was a deliberate, per-view choice (see each view file's header comment), not an oversight — htmx is there for when a flow genuinely needs partial-page interactivity, which hasn't come up yet.

## 2. Request lifecycle (a typical authenticated request)

```mermaid
sequenceDiagram
    participant B as Browser
    participant W as Hono app (index.tsx)
    participant G as requireTeacher\n(authGuard.ts)
    participant S as session.ts
    participant L as src/lib/*.ts\n(business logic)
    participant D as D1 (via db.ts)

    B->>W: GET /classes\n(Cookie: tktk_session=...)
    W->>G: requireTeacher middleware
    G->>S: readSession(cookie, SESSION_SECRET)
    S-->>G: {userId, email, role, exp} or null
    alt no valid session, or role != teacher
        G-->>B: 303 redirect to /auth/login
    else valid teacher session
        G->>W: c.set("session", ...) then next()
        W->>L: listClassesForTeacher(db, userId)
        L->>D: SELECT ... FROM class_teachers JOIN classes\nWHERE class_teachers.user_id = ?
        D-->>L: rows
        L-->>W: ClassListItem[]
        W-->>B: 200, rendered HTML (ClassListPage)
    end
```

Every protected route follows this same shape: `requireTeacher` middleware gates access, a `src/lib/*.ts` module holds the actual query/mutation logic (never inline in the route handler — `CLAUDE.md` rule 3), and `src/db.ts` is the *only* place that touches the D1 binding directly.

## 3. Data model

```mermaid
erDiagram
    users ||--o{ class_teachers : "teaches"
    users ||--o{ class_students : "is a member of"
    classes ||--o{ class_teachers : "has"
    classes ||--o{ class_students : "has"
    classes ||--o{ invites : "has"
    users ||--o{ invites : "sent by"
    classes ||--o{ class_sessions : "has"

    users {
        text id PK
        text passwordHash "PBKDF2, never magic-link"
        text email UK "login identifier AND contact/invite-matching"
        text name "optional, deferred profile concept"
        text role "teacher | student"
    }
    classes {
        text id PK
        text name
        text description
        text startDate "optional, YYYY-MM-DD"
        text endDate "optional, YYYY-MM-DD"
        text joinCode UK "6-char, human-typeable"
        text createdBy FK "audit only, NOT the access-control source"
    }
    class_teachers {
        text classId PK_FK
        text userId PK_FK
        text role "owner | co-teacher"
    }
    class_students {
        text classId PK_FK
        text userId PK_FK "may point at a PLACEHOLDER user\nuntil the invite is accepted"
        text status "invited | active"
    }
    invites {
        text id PK "reused as the placeholder user's id"
        text classId FK
        text email "who was actually invited"
        text token UK "enrollment link, NOT an auth token"
        text invitedBy FK
        text status "pending | accepted | expired | revoked"
    }
    class_sessions {
        text id PK
        text classId FK
        int number "auto-assigned, MAX(number)+1 per class"
        text date "optional, YYYY-MM-DD"
        text title "optional"
    }
```

**Two things that aren't obvious from the diagram alone:**

- **Class access is scoped through `class_teachers`, never `classes.createdBy`.** `createdBy` is an audit field (who originally made the class); the actual "can this user see/edit this class" check always joins through `class_teachers`. This was a deliberate choice made *before* co-teacher support existed (`tktk-lfc.3`, not yet built), specifically so that feature won't need every existing query rewritten when it lands.
- **The placeholder-user pattern (invites).** `class_students.userId` is `NOT NULL` and foreign-keyed to `users.id`, enforced eagerly by D1 — but an invited student doesn't have a real account until they accept. `createInvite` (`src/lib/invites.ts`) inserts a placeholder `users` row (unusable credentials, an RFC 2606 `*.invalid` email) using the invite's own `id` as the placeholder's `id`, so `acceptInvite` can convert it in place at signup with no extra lookup. See the module-level comment in `src/lib/invites.ts` for the full reasoning — this is the single most subtle piece of the current schema.

## 4. Auth flow

```mermaid
sequenceDiagram
    participant B as Browser
    participant W as index.tsx
    participant A as auth.ts
    participant P as password.ts
    participant S as session.ts
    participant D as D1

    rect rgb(30, 40, 50)
    Note over B,D: Signup (teacher self-registration only)
    B->>W: POST /auth/signup {email, password}
    W->>A: signupTeacher(db, input)
    A->>D: check email uniqueness
    A->>P: hashPassword(password)
    P-->>A: PBKDF2 hash (210k iterations)
    A->>D: INSERT users (role: teacher)
    A-->>W: {ok, user}
    W->>S: createSessionCookie(userId, email, role)
    W-->>B: 303 -> /classes, Set-Cookie
    end

    rect rgb(30, 40, 50)
    Note over B,D: Login
    B->>W: POST /auth/login {email, password}
    W->>A: verifyLogin(db, input)
    A->>D: find user by email
    alt user not found
        A->>P: verifyPassword(password, DUMMY_HASH)
        Note right of A: still runs a full PBKDF2 derivation --<br/>closes a timing side-channel that would<br/>otherwise let response time alone reveal<br/>whether the email exists
    else user found
        A->>P: verifyPassword(password, user.passwordHash)
    end
    P-->>A: true/false
    alt invalid
        A-->>W: null
        W-->>B: 400, "Invalid email or password."\n(identical message either way)
    else valid
        A-->>W: {id, email, role}
        W->>S: createSessionCookie(...)
        W-->>B: 303 -> /classes, Set-Cookie
    end
    end
```

Sessions are **stateless signed cookies** (`src/lib/session.ts`) — no session table, no KV namespace. The cookie holds a base64url JSON payload plus an HMAC-SHA256 signature keyed by `SESSION_SECRET`; `readSession` rejects a tampered or expired cookie by returning `null`, never throwing.

## 5. Invite flow

The most involved flow in the app so far — a teacher inviting a student who may or may not already have an account.

```mermaid
flowchart TD
    Start(["Teacher: POST /classes/:id/invites"]) --> Check1{"Already a pending\ninvite for this\nclass+email?"}
    Check1 -->|yes| Reject1["400: already invited"]
    Check1 -->|no| Check2{"Email already a\nmember of this class?"}
    Check2 -->|yes| Reject2["400: already a member"]
    Check2 -->|no| Create["db.batch(): insert placeholder user\n+ invites row (pending)\n+ class_students row (invited)"]
    Create --> Send["sendInviteEmail()\n(Resend, or console log\nin dev without a real key)"]
    Send --> Wait(["Student clicks the link:\nGET /invites/:token"])

    Wait --> Lookup{"Token status?"}
    Lookup -->|not found| S1["404"]
    Lookup -->|expired| S2["410\n(status flipped to\nexpired on this GET)"]
    Lookup -->|already accepted| S3["409"]
    Lookup -->|revoked| S4["410"]
    Lookup -->|"email already has\na real account"| Check3{"Visitor is logged in\nas that exact account?"}
    Check3 -->|yes| AutoAttach["attachInviteToExistingUser():\nrepoint class_students,\ndelete placeholder"]
    Check3 -->|no| S5["409: log in instead"]
    Lookup -->|valid, pending| Form(["Signup form\n(email locked, not editable\nor even submitted)"])

    Form --> Submit["POST /invites/:token\n{password, name}"]
    Submit --> Accept["acceptInvite():\nUPDATE the placeholder row\nin place (same id) with real\npassword/email"]
    Accept --> Finish(["Session created,\nredirect home"])
    AutoAttach --> Finish
```

## 6. Route map

| Route | Auth | Purpose |
|---|---|---|
| `GET /` | none | Placeholder home |
| `GET /auth/signup`, `POST /auth/signup` | none | Teacher self-registration |
| `GET /auth/login`, `POST /auth/login` | none | Login |
| `POST /auth/logout` | none (clears cookie either way) | Logout |
| `GET /classes` | `requireTeacher` | Teacher's class list + create-class form |
| `POST /classes` | `requireTeacher` | Create a class (+ owner `class_teachers` row) |
| `GET /classes/:id` | `requireTeacher` + class membership | Class detail, join code, teachers, pending invites |
| `POST /classes/:id/invites` | `requireTeacher` + class membership | Invite a student by email |
| `GET /invites/:token`, `POST /invites/:token` | none (public — the token *is* the auth) | Invite acceptance / student signup |

**Not yet built:** anything under a join-code route (`tktk-lfc.5`), co-teacher add/remove UI (`tktk-lfc.3`), the full roster view with active-student listing and removal (`tktk-lfc.6`), and any student-facing page — a student who signs up currently lands on the same placeholder `/` page a logged-out visitor sees.

## 7. Agentic development workflow

```mermaid
flowchart LR
    PM["product-manager\nscopes bd issues,\nguards MVP boundary"]
    Dev["developer\nimplements routes +\nsrc/lib/ logic"]
    Test["tester\nwrites/runs coverage\n(not yet exercised this project)"]
    Rev["reviewer\nadversarial checklist pass\n(not yet exercised this project)"]
    UI["ui-agent\nviews, htmx wiring,\ndesign system"]

    PM -->|bd issue| Dev
    Dev -->|handoff| Test
    Test -->|handoff| Rev
    Dev -.->|views/screens| UI
    Rev -->|approved| Merge(["git commit / PR"])

    Merge --> PreCommit["pre-commit hook:\nlint-staged + Flaught\n(BLOCKING)"]
    PreCommit --> PrePush["pre-push hook:\ntypecheck + lint\n(BLOCKING)"]
    PrePush --> CI["GitHub Actions:\nlint/typecheck + Flaught\n(NON-blocking PR comment)"]
    CI --> Deploy["deploy.yml:\npreview on PR,\nprod on merge to main"]
```

In practice this session, `developer` and `ui-agent` passes have been the ones exercised (`tester`/`reviewer` roles have mostly been done by the orchestrating session directly — independent re-verification against a real local D1 after each subagent's own report, rather than a separate `tester`/`reviewer` handoff). Every commit still goes through the two blocking local hooks regardless of which agent made it.

## 8. What's deliberately not here yet

Scope boundaries from `CLAUDE.md`, not gaps to fill reflexively: no assignments, submissions, feedback/grading, or peer-review features (that's the *next* milestone, after this class+roster MVP). No persistent staging environment — prod + PR previews only, and PR preview database isolation itself isn't designed yet (`docs/deployment.md` "Known gap"). No dark mode. No test suite. See `bd show tktk-lfc` for exactly what's open.

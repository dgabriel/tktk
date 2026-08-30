// Hono app entry. Route handlers stay thin (CLAUDE.md rule 3) — business
// logic belongs in src/lib/, views in src/views/.

import { Hono } from "hono";
import type { Env } from "./db";
import { getDb } from "./db";
import { Layout } from "./views/Layout";
import { LoginPage, SignupPage } from "./views/Auth";
import { ClassDetailPage, ClassListPage, InviteEmailsField } from "./views/Classes";
import { InviteAcceptPage } from "./views/Invites";
import { JoinPage } from "./views/Join";
import { signupTeacher, verifyLogin } from "./lib/auth";
import { clearSessionCookie, createSessionCookie, readSession, type Variables } from "./lib/session";
import { requireTeacher } from "./lib/authGuard";
import {
  addCoTeacher,
  createClass,
  getClassDetailForTeacher,
  listClassesForTeacher,
  removeClassMember,
} from "./lib/classes";
import {
  acceptInvite,
  attachInviteToExistingUser,
  createInvites,
  extractEmails,
  getInviteForAcceptance,
  listPendingInvites,
} from "./lib/invites";
import { joinClassAsExistingUser, joinClassWithSignup } from "./lib/join";
import { sendInviteEmail } from "./lib/email";
import { createSession, listSessionsForClass } from "./lib/sessions";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.get("/", async (c) => {
  const session = await readSession(c, c.env.SESSION_SECRET);

  // Teachers land on their real home page. Students have no dashboard yet
  // in this MVP (the whole built UI so far is teacher-facing, same gap
  // every post-signup/accept/join redirect already notes) -- give them an
  // honest logged-in placeholder instead of silently bouncing them
  // somewhere that pretends there's more here than there is.
  if (session?.role === "teacher") {
    return c.redirect("/classes", 303);
  }

  if (session) {
    return c.html(
      <Layout title="tktk" loggedInAs={session.email}>
        <main class="container-narrow">
          <h1>tktk</h1>
          <p>You're signed in. There's no student dashboard yet in this MVP.</p>
        </main>
      </Layout>,
    );
  }

  return c.html(
    <Layout title="tktk">
      <main class="container-narrow stack">
        <h1>tktk</h1>
        <p class="text-muted">Class and roster management for writing workshops.</p>
        <div class="panel stack">
          <a class="btn" href="/auth/login">
            Log in
          </a>
          <a class="btn-secondary" href="/auth/signup">
            Sign up as a teacher
          </a>
          <a class="btn-secondary" href="/join">
            Join a class with a code
          </a>
        </div>
      </main>
    </Layout>,
  );
});

app.get("/auth/login", (c) => c.html(<LoginPage />));

app.get("/auth/signup", (c) => c.html(<SignupPage />));

app.post("/auth/signup", async (c) => {
  const body = await c.req.parseBody();
  const email = String(body.email ?? "").trim();
  const name = String(body.name ?? "").trim();
  const password = String(body.password ?? "");

  const db = getDb(c.env);
  const result = await signupTeacher(db, { email, name: name || undefined, password });

  if (!result.ok) {
    return c.html(<SignupPage errors={result.errors} values={{ email, name }} />, 400);
  }

  await createSessionCookie(c, c.env.SESSION_SECRET, {
    userId: result.user.id,
    email: result.user.email,
    role: "teacher",
  });

  return c.redirect("/classes", 303);
});

app.post("/auth/login", async (c) => {
  const body = await c.req.parseBody();
  const email = String(body.email ?? "").trim();
  const password = String(body.password ?? "");

  const db = getDb(c.env);
  const user = await verifyLogin(db, { email, password });

  if (!user) {
    // Generic message -- do not reveal whether the email exists or the
    // password was wrong (avoids email enumeration).
    return c.html(<LoginPage error="Invalid email or password." email={email} />, 400);
  }

  await createSessionCookie(c, c.env.SESSION_SECRET, {
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  return c.redirect("/classes", 303);
});

app.post("/auth/logout", (c) => {
  clearSessionCookie(c);
  return c.redirect("/auth/login", 303);
});

app.get("/classes", requireTeacher, async (c) => {
  const session = c.get("session");
  const db = getDb(c.env);
  const classes = await listClassesForTeacher(db, session.userId);

  return c.html(<ClassListPage classes={classes} loggedInAs={session.email} />);
});

app.post("/classes", requireTeacher, async (c) => {
  const session = c.get("session");
  const body = await c.req.parseBody();
  const name = String(body.name ?? "").trim();
  const startDate = String(body.startDate ?? "").trim();
  const endDate = String(body.endDate ?? "").trim();
  const description = String(body.description ?? "").trim();

  const db = getDb(c.env);
  const result = await createClass(db, {
    name,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    description: description || undefined,
    createdBy: session.userId,
  });

  if (!result.ok) {
    const classes = await listClassesForTeacher(db, session.userId);
    return c.html(
      <ClassListPage
        classes={classes}
        loggedInAs={session.email}
        errors={result.errors}
        values={{ name, startDate, endDate, description }}
      />,
      400,
    );
  }

  return c.redirect(`/classes/${result.id}`, 303);
});

app.get("/classes/:id", requireTeacher, async (c) => {
  const session = c.get("session");
  const db = getDb(c.env);
  const classDetail = await getClassDetailForTeacher(db, c.req.param("id"), session.userId);

  if (!classDetail) {
    return c.redirect("/classes", 303);
  }

  const pendingInvites = await listPendingInvites(db, classDetail.id);
  const sessions = await listSessionsForClass(db, classDetail.id);

  return c.html(
    <ClassDetailPage classDetail={classDetail} loggedInAs={session.email} pendingInvites={pendingInvites} sessions={sessions} />,
  );
});

app.post("/classes/:id/teachers", requireTeacher, async (c) => {
  const session = c.get("session");
  const db = getDb(c.env);
  const classId = c.req.param("id");

  // Membership check, not just "is a teacher" -- must be a teacher on THIS
  // class. Any teacher on the class may add a co-teacher (kickoff brief §2:
  // no owner-only hierarchy), so this is the same check the invite route
  // uses, not an owner-only one.
  const classDetail = await getClassDetailForTeacher(db, classId, session.userId);
  if (!classDetail) {
    return c.redirect("/classes", 303);
  }

  const body = await c.req.parseBody();
  const email = String(body.email ?? "").trim();

  const result = await addCoTeacher(db, { classId, email });
  const pendingInvites = await listPendingInvites(db, classId);
  const sessions = await listSessionsForClass(db, classId);

  if (!result.ok) {
    return c.html(
      <ClassDetailPage
        classDetail={classDetail}
        loggedInAs={session.email}
        pendingInvites={pendingInvites}
        sessions={sessions}
        teacherError={result.error}
        teacherValues={{ email }}
      />,
      400,
    );
  }

  const updatedClassDetail = await getClassDetailForTeacher(db, classId, session.userId);
  return c.html(
    <ClassDetailPage
      classDetail={updatedClassDetail ?? classDetail}
      loggedInAs={session.email}
      pendingInvites={pendingInvites}
      sessions={sessions}
      teacherSuccess={`Added ${email} as a co-teacher.`}
    />,
  );
});

// Server-side "Clean up list" preview for the invite panel's textarea --
// htmx-driven in-place swap, not a page navigation (never reached via
// hx-push-url), so CLAUDE.md rule 3a's HX-Request branching doesn't apply
// here, same reasoning as the delete-row routes below. Runs the exact same
// extractEmails() the real submit route uses, so what the teacher previews
// is never out of sync with what actually gets invited.
app.post("/classes/:id/invites/clean", requireTeacher, async (c) => {
  const session = c.get("session");
  const db = getDb(c.env);
  const classId = c.req.param("id");

  const classDetail = await getClassDetailForTeacher(db, classId, session.userId);
  if (!classDetail) {
    return c.body(null, 404);
  }

  const body = await c.req.parseBody();
  const raw = String(body.emails ?? "");
  const emails = extractEmails(raw);

  return c.html(<InviteEmailsField classId={classId} value={emails.join(", ")} foundCount={emails.length} />);
});

app.post("/classes/:id/invites", requireTeacher, async (c) => {
  const session = c.get("session");
  const db = getDb(c.env);
  const classId = c.req.param("id");

  // Membership check, not just "is a teacher" -- must be a teacher on THIS
  // class. getClassDetailForTeacher already treats "no such class" and
  // "not one of its teachers" identically (returns null for both).
  const classDetail = await getClassDetailForTeacher(db, classId, session.userId);
  if (!classDetail) {
    return c.redirect("/classes", 303);
  }

  const body = await c.req.parseBody();
  const raw = String(body.emails ?? "");
  const emails = extractEmails(raw);
  const sessions = await listSessionsForClass(db, classId);

  if (emails.length === 0) {
    const pendingInvites = await listPendingInvites(db, classId);
    return c.html(
      <ClassDetailPage
        classDetail={classDetail}
        loggedInAs={session.email}
        pendingInvites={pendingInvites}
        sessions={sessions}
        inviteError="Paste at least one valid email address."
        inviteValues={{ emails: raw }}
      />,
      400,
    );
  }

  const results = await createInvites(db, { classId, emails, invitedBy: session.userId });
  const invited = results.filter((r) => r.ok);
  const rejected = results.filter((r): r is Extract<(typeof results)[number], { ok: false }> => !r.ok);

  const origin = new URL(c.req.url).origin;
  const sendFailures: string[] = [];
  for (const result of invited) {
    const inviteLink = `${origin}/invites/${result.token}`;
    try {
      await sendInviteEmail(c.env, { to: result.email, inviteLink, className: classDetail.name });
    } catch (err) {
      // The invites/class_students rows are already committed at this point --
      // a Resend failure shouldn't roll that back, just surface it distinctly
      // so the teacher knows which students won't have gotten an email.
      console.error("Failed to send invite email:", err);
      sendFailures.push(result.email);
    }
  }

  if (invited.length === 0) {
    const pendingInvites = await listPendingInvites(db, classId);
    return c.html(
      <ClassDetailPage
        classDetail={classDetail}
        loggedInAs={session.email}
        pendingInvites={pendingInvites}
        sessions={sessions}
        inviteError={rejected.map((r) => `${r.email}: ${r.error}`).join(" ")}
        inviteValues={{ emails: raw }}
      />,
      400,
    );
  }

  let inviteSuccess = `Invited ${invited.length} student${invited.length === 1 ? "" : "s"}.`;
  if (sendFailures.length > 0) {
    inviteSuccess += ` ${sendFailures.length} email${sendFailures.length === 1 ? "" : "s"} failed to send (${sendFailures.join(", ")}).`;
  }
  if (rejected.length > 0) {
    inviteSuccess += ` Skipped ${rejected.length}: ${rejected.map((r) => `${r.email} (${r.error})`).join("; ")}.`;
  }

  const pendingInvites = await listPendingInvites(db, classId);
  return c.html(
    <ClassDetailPage
      classDetail={classDetail}
      loggedInAs={session.email}
      pendingInvites={pendingInvites}
      sessions={sessions}
      inviteSuccess={inviteSuccess}
    />,
  );
});

// Plain form POST, same shape/reasoning as /classes/:id/teachers and
// /classes/:id/invites above -- never reached via hx-push-url, so CLAUDE.md
// rule 3a's HX-Request branching doesn't apply.
app.post("/classes/:id/sessions", requireTeacher, async (c) => {
  const session = c.get("session");
  const db = getDb(c.env);
  const classId = c.req.param("id");

  const classDetail = await getClassDetailForTeacher(db, classId, session.userId);
  if (!classDetail) {
    return c.redirect("/classes", 303);
  }

  const body = await c.req.parseBody();
  const date = String(body.date ?? "").trim();
  const title = String(body.title ?? "").trim();

  const result = await createSession(db, { classId, date: date || undefined, title: title || undefined });
  const pendingInvites = await listPendingInvites(db, classId);

  if (!result.ok) {
    const sessions = await listSessionsForClass(db, classId);
    return c.html(
      <ClassDetailPage
        classDetail={classDetail}
        loggedInAs={session.email}
        pendingInvites={pendingInvites}
        sessions={sessions}
        sessionError={result.errors.date}
        sessionValues={{ date, title }}
      />,
      400,
    );
  }

  const sessions = await listSessionsForClass(db, classId);
  return c.html(
    <ClassDetailPage
      classDetail={classDetail}
      loggedInAs={session.email}
      pendingInvites={pendingInvites}
      sessions={sessions}
      sessionSuccess={`Added session ${sessions.find((s) => s.id === result.id)?.number ?? ""}.`}
    />,
  );
});

// htmx-driven row removal, not a page navigation -- never reached via
// hx-push-url, so CLAUDE.md rule 3a's HX-Request full-page-vs-fragment
// branching doesn't apply here (see htmx-4.0-notes.md). Empty response is
// the whole contract: hx-swap="delete" on the caller's button just removes
// the target element regardless of body content.
app.delete("/classes/:id/students/:userId", requireTeacher, async (c) => {
  const session = c.get("session");
  const db = getDb(c.env);
  const classId = c.req.param("id");
  const userId = c.req.param("userId");

  // Same class-membership check as every other /classes/:id/* route --
  // "no such class" and "not one of its teachers" are both a 404 here, not
  // distinguished (getClassDetailForTeacher already collapses them).
  const classDetail = await getClassDetailForTeacher(db, classId, session.userId);
  if (!classDetail) {
    return c.body(null, 404);
  }

  const result = await removeClassMember(db, { classId, userId });
  if (!result.ok) {
    return c.body(null, 404);
  }

  return c.body(null, 200);
});

app.get("/invites/:token", async (c) => {
  const db = getDb(c.env);
  const token = c.req.param("token");
  const lookup = await getInviteForAcceptance(db, token);

  if (lookup.status === "existing_account") {
    // If the visitor is already logged in as exactly the invited account,
    // skip the signup form and attach them to the class directly.
    const session = await readSession(c, c.env.SESSION_SECRET);
    if (session && session.email === lookup.invite.email) {
      const attached = await attachInviteToExistingUser(db, { token, userId: session.userId });
      if (attached.ok) {
        // No student-facing page exists yet in this MVP (teacher-only UI so
        // far) -- redirect home rather than to a page that doesn't exist.
        return c.redirect("/", 303);
      }
    }
    return c.html(<InviteAcceptPage state="existing_account" email={lookup.invite.email} />, 409);
  }

  if (lookup.status === "valid") {
    return c.html(<InviteAcceptPage state="form" email={lookup.invite.email} className={lookup.invite.className} />);
  }

  const statusCode = lookup.status === "not_found" ? 404 : lookup.status === "accepted" ? 409 : 410;
  return c.html(<InviteAcceptPage state={lookup.status} />, statusCode);
});

app.post("/invites/:token", async (c) => {
  const db = getDb(c.env);
  const token = c.req.param("token");
  const body = await c.req.parseBody();
  const name = String(body.name ?? "").trim();
  const password = String(body.password ?? "");

  const result = await acceptInvite(db, { token, password, name: name || undefined });

  if (!result.ok) {
    if (result.status === "validation") {
      const lookup = await getInviteForAcceptance(db, token);
      if (lookup.status === "valid") {
        return c.html(
          <InviteAcceptPage
            state="form"
            email={lookup.invite.email}
            className={lookup.invite.className}
            errors={result.errors}
            values={{ name }}
          />,
          400,
        );
      }
      // Invite state changed out from under this submission (e.g. expired
      // between GET and POST) -- fall through to the generic state render.
      if (lookup.status === "existing_account") {
        return c.html(<InviteAcceptPage state="existing_account" email={lookup.invite.email} />, 409);
      }
      return c.html(<InviteAcceptPage state={lookup.status} />, 409);
    }

    if (result.status === "existing_account") {
      return c.html(<InviteAcceptPage state="existing_account" email={result.email} />, 409);
    }

    const statusCode =
      result.status === "not_found" ? 404 : result.status === "accepted" || result.status === "conflict" ? 409 : 410;
    return c.html(<InviteAcceptPage state={result.status} />, statusCode);
  }

  await createSessionCookie(c, c.env.SESSION_SECRET, {
    userId: result.user.id,
    email: result.user.email,
    role: "student",
  });

  // No student-facing dashboard exists yet in this MVP -- out of scope for
  // this issue (see kickoff brief: only teacher UI has been built so far).
  // Redirect home rather than to a page that doesn't exist; revisit once a
  // student homepage lands.
  return c.redirect("/", 303);
});

app.get("/join", async (c) => {
  const session = await readSession(c, c.env.SESSION_SECRET);
  return c.html(<JoinPage mode={session ? "member" : "signup"} />);
});

app.post("/join", async (c) => {
  const session = await readSession(c, c.env.SESSION_SECRET);
  const db = getDb(c.env);
  const body = await c.req.parseBody();
  const joinCode = String(body.joinCode ?? "").trim();

  if (session) {
    const result = await joinClassAsExistingUser(db, { joinCode, userId: session.userId, role: session.role });

    if (!result.ok) {
      const error =
        result.status === "invalid_code"
          ? "That join code isn't valid."
          : result.status === "not_a_student"
            ? "Teacher accounts can't join a class as a student."
            : "You're already a member of that class.";
      const statusCode = result.status === "invalid_code" ? 404 : result.status === "not_a_student" ? 403 : 409;
      return c.html(<JoinPage mode="member" error={error} joinCode={joinCode} />, statusCode);
    }

    // No student-facing dashboard exists yet in this MVP (teacher-only UI so
    // far, same gap noted in the invite-acceptance route) -- redirect home
    // rather than to a page that doesn't exist.
    return c.redirect("/", 303);
  }

  const email = String(body.email ?? "").trim();
  const password = String(body.password ?? "");

  const result = await joinClassWithSignup(db, { joinCode, email, password });

  if (!result.ok) {
    if (result.status === "invalid_code") {
      return c.html(
        <JoinPage mode="signup" error="That join code isn't valid." joinCode={joinCode} values={{ email }} />,
        404,
      );
    }
    if (result.status === "validation") {
      return c.html(
        <JoinPage mode="signup" joinCode={joinCode} errors={result.errors} values={{ email }} />,
        400,
      );
    }
    // conflict: a concurrent request took the same email between this
    // request's pre-check and its insert.
    return c.html(
      <JoinPage
        mode="signup"
        error="That email was just taken. Try again."
        joinCode={joinCode}
        values={{ email }}
      />,
      409,
    );
  }

  await createSessionCookie(c, c.env.SESSION_SECRET, {
    userId: result.user.id,
    email: result.user.email,
    role: "student",
  });

  return c.redirect("/", 303);
});

export default app;

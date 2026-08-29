// Class list + class detail pages. Plain server-rendered forms/links (no
// hx-* attributes) -- same reasoning as Auth.tsx: full browser
// POST/redirect is the simplest correct thing here, and these routes are
// never hit via hx-push-url, so CLAUDE.md rule 3a's HX-Request branching
// doesn't apply yet.

import type { FC } from "hono/jsx";
import { Layout } from "./Layout";
import type { ClassDetail, ClassListItem } from "../lib/classes";
import type { PendingInvite } from "../lib/invites";

export type ClassFormErrors = { name?: string };
export type ClassFormValues = { name?: string; term?: string; description?: string };

export const ClassListPage: FC<{
  classes: ClassListItem[];
  loggedInAs: string;
  errors?: ClassFormErrors;
  values?: ClassFormValues;
}> = ({ classes, loggedInAs, errors = {}, values = {} }) => (
  <Layout title="Your classes" loggedInAs={loggedInAs}>
    <main class="container stack">
      <h1>Your classes</h1>

      {classes.length === 0 ? (
        <p class="text-muted">You don't have any classes yet -- create one below.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Term</th>
              <th>Join code</th>
            </tr>
          </thead>
          <tbody>
            {classes.map((cls) => (
              <tr>
                <td>
                  <a href={`/classes/${cls.id}`}>{cls.name}</a>
                </td>
                <td>{cls.term ?? "—"}</td>
                <td>{cls.joinCode}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div class="panel stack">
        <h2>Create a class</h2>
        <form method="post" action="/classes" class="stack">
          <div class="field">
            <label for="name">Name</label>
            <input
              type="text"
              id="name"
              name="name"
              required
              value={values.name ?? ""}
              aria-invalid={errors.name ? "true" : undefined}
            />
            {errors.name && <p class="field-error">{errors.name}</p>}
          </div>
          <div class="field">
            <label for="term">
              Term <span class="text-muted">(optional)</span>
            </label>
            <input type="text" id="term" name="term" placeholder="e.g. Fall 2026" value={values.term ?? ""} />
          </div>
          <div class="field">
            <label for="description">
              Description <span class="text-muted">(optional)</span>
            </label>
            <textarea id="description" name="description" rows={3}>
              {values.description ?? ""}
            </textarea>
          </div>
          <button type="submit" class="btn">
            Create class
          </button>
        </form>
      </div>
    </main>
  </Layout>
);

export type InviteFormErrors = { email?: string };
export type InviteFormValues = { email?: string };

export const ClassDetailPage: FC<{
  classDetail: ClassDetail;
  loggedInAs: string;
  pendingInvites?: PendingInvite[];
  inviteError?: string;
  inviteSuccess?: string;
  inviteValues?: InviteFormValues;
}> = ({ classDetail, loggedInAs, pendingInvites = [], inviteError, inviteSuccess, inviteValues = {} }) => (
  <Layout title={classDetail.name} loggedInAs={loggedInAs}>
    <main class="container stack">
      <p>
        <a href="/classes">&larr; Your classes</a>
      </p>

      <h1>{classDetail.name}</h1>
      {classDetail.term && <p class="text-muted">{classDetail.term}</p>}
      {classDetail.description && <p>{classDetail.description}</p>}

      <div class="panel stack">
        <h2>Join code</h2>
        <p class="text-lg">
          <strong>{classDetail.joinCode}</strong>
        </p>
        <p class="text-sm text-muted">Share this code with students so they can join the class.</p>
      </div>

      <div class="panel stack">
        <h2>Teachers</h2>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {classDetail.teachers.map((teacher) => (
              <tr>
                <td>{teacher.name || teacher.username}</td>
                <td>{teacher.email}</td>
                <td>{teacher.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div class="panel stack">
        <h2>Invite a student</h2>
        {inviteSuccess && <p class="message message-success">{inviteSuccess}</p>}
        {inviteError && <p class="message message-error">{inviteError}</p>}
        <form method="post" action={`/classes/${classDetail.id}/invites`} class="stack">
          <div class="field">
            <label for="invite-email">Email</label>
            <input
              type="email"
              id="invite-email"
              name="email"
              required
              value={inviteValues.email ?? ""}
            />
          </div>
          <button type="submit" class="btn">
            Send invite
          </button>
        </form>

        {pendingInvites.length > 0 && (
          <>
            <h3>Pending invites</h3>
            <table>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Invited</th>
                </tr>
              </thead>
              <tbody>
                {pendingInvites.map((invite) => (
                  <tr>
                    <td>{invite.email}</td>
                    <td>{invite.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </main>
  </Layout>
);

// Class list + class detail pages. The create-class/add-co-teacher/
// invite-students forms are plain server-rendered forms (no hx-* attributes
// on the form/submit itself) -- same reasoning as Auth.tsx: full browser
// POST/redirect is the simplest correct thing here, and none of those routes
// are hit via hx-push-url, so CLAUDE.md rule 3a's HX-Request branching
// doesn't apply to them. Three buttons are the exception -- real in-place
// swaps, not page navigations, so no HX-Request branching needed there
// either: the Remove/Revoke buttons in the Students and Pending invites
// tables (hx-delete + hx-swap="delete"), and the invite panel's "Clean up
// list" button (hx-post to /classes/:id/invites/clean, swaps in a
// server-parsed preview of InviteEmailsField -- see the route comment in
// src/index.tsx and htmx-4.0-notes.md).

import type { FC } from "hono/jsx";
import { Layout } from "./Layout";
import type { ClassDetail, ClassListItem } from "../lib/classes";
import type { PendingInvite } from "../lib/invites";

// Parses as UTC midnight and formats in UTC -- avoids an off-by-one-day
// shift a local-timezone parse/format could introduce for a value that's
// a pure calendar date with no time component to begin with.
function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function formatDateRange(start: string | null, end: string | null): string {
  if (start && end) return `${formatDate(start)} – ${formatDate(end)}`;
  if (start) return `Starts ${formatDate(start)}`;
  if (end) return `Ends ${formatDate(end)}`;
  return "—";
}

export type ClassFormErrors = { name?: string; startDate?: string; endDate?: string };
export type ClassFormValues = { name?: string; startDate?: string; endDate?: string; description?: string };

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
              <th>Dates</th>
              <th>Join code</th>
            </tr>
          </thead>
          <tbody>
            {classes.map((cls) => (
              <tr>
                <td>
                  <a href={`/classes/${cls.id}`}>{cls.name}</a>
                </td>
                <td>{formatDateRange(cls.startDate, cls.endDate)}</td>
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
            <label for="startDate">
              Start date <span class="text-muted">(optional)</span>
            </label>
            <input
              type="date"
              id="startDate"
              name="startDate"
              value={values.startDate ?? ""}
              aria-invalid={errors.startDate ? "true" : undefined}
            />
            {errors.startDate && <p class="field-error">{errors.startDate}</p>}
          </div>
          <div class="field">
            <label for="endDate">
              End date <span class="text-muted">(optional)</span>
            </label>
            <input
              type="date"
              id="endDate"
              name="endDate"
              value={values.endDate ?? ""}
              aria-invalid={errors.endDate ? "true" : undefined}
            />
            {errors.endDate && <p class="field-error">{errors.endDate}</p>}
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

export type InviteFormValues = { emails?: string };
export type TeacherFormValues = { email?: string };

// Shared by the full ClassDetailPage render and the "Clean up list" htmx
// fragment endpoint (POST /classes/:id/invites/clean) -- so the preview a
// teacher sees is generated by the exact same markup as the real form field,
// not a hand-kept-in-sync copy of it.
export const InviteEmailsField: FC<{ classId: string; value: string; foundCount?: number }> = ({
  classId,
  value,
  foundCount,
}) => (
  <div id="invite-emails-field" class="field">
    <label for="invite-emails">Emails</label>
    <textarea
      id="invite-emails"
      name="emails"
      rows={4}
      placeholder={
        'Paste one or more emails -- one per line, comma-separated, or copied straight from Gmail (e.g. "Emily Dickinson <edickinson@example.com>, Audre Lorde <alorde@example.com>")'
      }
    >
      {value}
    </textarea>
    {foundCount !== undefined && (
      <p class="text-sm text-muted">
        {foundCount} email{foundCount === 1 ? "" : "s"} found.
      </p>
    )}
    <button
      type="button"
      class="btn-secondary"
      hx-post={`/classes/${classId}/invites/clean`}
      hx-target="#invite-emails-field"
      hx-swap="outerHTML"
    >
      Clean up list
    </button>
  </div>
);

export const ClassDetailPage: FC<{
  classDetail: ClassDetail;
  loggedInAs: string;
  pendingInvites?: PendingInvite[];
  inviteError?: string;
  inviteSuccess?: string;
  inviteValues?: InviteFormValues;
  teacherError?: string;
  teacherSuccess?: string;
  teacherValues?: TeacherFormValues;
}> = ({
  classDetail,
  loggedInAs,
  pendingInvites = [],
  inviteError,
  inviteSuccess,
  inviteValues = {},
  teacherError,
  teacherSuccess,
  teacherValues = {},
}) => (
  <Layout title={classDetail.name} loggedInAs={loggedInAs}>
    <main class="container stack">
      <p>
        <a href="/classes">&larr; Your classes</a>
      </p>

      <h1>{classDetail.name}</h1>
      {(classDetail.startDate || classDetail.endDate) && (
        <p class="text-muted">{formatDateRange(classDetail.startDate, classDetail.endDate)}</p>
      )}
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
                <td>{teacher.name || teacher.email}</td>
                <td>{teacher.email}</td>
                <td>{teacher.role}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3>Add a co-teacher</h3>
        {teacherSuccess && <p class="message message-success">{teacherSuccess}</p>}
        {teacherError && <p class="message message-error">{teacherError}</p>}
        <form method="post" action={`/classes/${classDetail.id}/teachers`} class="stack">
          <div class="field">
            <label for="teacher-email">Email</label>
            <input
              type="email"
              id="teacher-email"
              name="email"
              required
              value={teacherValues.email ?? ""}
            />
          </div>
          <button type="submit" class="btn">
            Add co-teacher
          </button>
        </form>
      </div>

      <div class="panel stack">
        <h2>Students</h2>
        {classDetail.students.length === 0 ? (
          <p class="text-muted">No active students yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {classDetail.students.map((student) => (
                <tr>
                  <td>{student.name || student.email}</td>
                  <td>{student.email}</td>
                  <td>
                    <button
                      type="button"
                      class="btn-secondary"
                      hx-delete={`/classes/${classDetail.id}/students/${student.userId}`}
                      hx-confirm={`Remove ${student.name || student.email} from this class?`}
                      hx-target="closest tr"
                      hx-swap="delete"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div class="panel stack">
        <h2>Invite students</h2>
        {inviteSuccess && <p class="message message-success">{inviteSuccess}</p>}
        {inviteError && <p class="message message-error">{inviteError}</p>}
        <form method="post" action={`/classes/${classDetail.id}/invites`} class="stack">
          <InviteEmailsField classId={classDetail.id} value={inviteValues.emails ?? ""} />
          <button type="submit" class="btn">
            Send invites
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
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pendingInvites.map((invite) => (
                  <tr>
                    <td>{invite.email}</td>
                    <td>{invite.createdAt}</td>
                    <td>
                      <button
                        type="button"
                        class="btn-secondary"
                        hx-delete={`/classes/${classDetail.id}/students/${invite.id}`}
                        hx-confirm={`Revoke the invite to ${invite.email}?`}
                        hx-target="closest tr"
                        hx-swap="delete"
                      >
                        Revoke
                      </button>
                    </td>
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

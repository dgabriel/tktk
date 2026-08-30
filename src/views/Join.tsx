// Public join-code enrollment page (GET/POST /join) -- no auth required, no
// hx-* attributes, same reasoning as Auth.tsx/Invites.tsx (plain browser
// POST/redirect, never hit via hx-push-url).
//
// Two distinct renders depending on whether the visitor already has a
// session (route handler branches on readSession before choosing `mode`):
// "member" is just a join-code field for an already-authenticated account,
// "signup" is the full join-code + account-creation form.

import type { FC } from "hono/jsx";
import { Layout } from "./Layout";
import type { JoinSignupFieldErrors } from "../lib/join";

export type JoinSignupFormValues = { email?: string };

export type JoinPageProps =
  | { mode: "member"; error?: string; joinCode?: string }
  | {
      mode: "signup";
      error?: string;
      errors?: JoinSignupFieldErrors;
      joinCode?: string;
      values?: JoinSignupFormValues;
    };

export const JoinPage: FC<JoinPageProps> = (props) => {
  if (props.mode === "member") {
    const { error, joinCode = "" } = props;
    return (
      <Layout title="Join a class">
        <main class="container-narrow">
          <div class="panel stack">
            <h1>Join a class</h1>
            <p class="text-muted text-sm">Enter the join code your teacher gave you.</p>
            {error && <p class="message message-error">{error}</p>}
            <form method="post" action="/join" class="stack">
              <div class="field">
                <label for="joinCode">Join code</label>
                <input
                  type="text"
                  id="joinCode"
                  name="joinCode"
                  required
                  autocomplete="off"
                  autocapitalize="characters"
                  value={joinCode}
                />
              </div>
              <button type="submit" class="btn">
                Join class
              </button>
            </form>
          </div>
        </main>
      </Layout>
    );
  }

  const { error, errors = {}, joinCode = "", values = {} } = props;

  return (
    <Layout title="Join a class">
      <main class="container-narrow">
        <div class="panel stack">
          <h1>Join a class</h1>
          <p class="text-muted text-sm">Enter your join code and create a student account.</p>
          {error && <p class="message message-error">{error}</p>}
          <form method="post" action="/join" class="stack">
            <div class="field">
              <label for="joinCode">Join code</label>
              <input
                type="text"
                id="joinCode"
                name="joinCode"
                required
                autocomplete="off"
                autocapitalize="characters"
                value={joinCode}
              />
            </div>
            <div class="field">
              <label for="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                required
                autocomplete="email"
                value={values.email ?? ""}
                aria-invalid={errors.email ? "true" : undefined}
              />
              {errors.email && <p class="field-error">{errors.email}</p>}
            </div>
            <div class="field">
              <label for="password">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                required
                autocomplete="new-password"
                aria-invalid={errors.password ? "true" : undefined}
              />
              <p class="field-hint">At least 8 characters.</p>
              {errors.password && <p class="field-error">{errors.password}</p>}
            </div>
            <button type="submit" class="btn">
              Join class
            </button>
          </form>
          <p class="text-sm">
            Already have an account? <a href="/auth/login">Log in</a>
          </p>
        </div>
      </main>
    </Layout>
  );
};

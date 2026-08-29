// Login/signup pages. Plain server-rendered forms (no hx-* attributes) --
// full browser POST/redirect is the simplest correct thing here and sidesteps
// htmx 4.0's HX-Request full-page-vs-fragment branching (CLAUDE.md rule 3a)
// entirely, since these routes are never hit via hx-push-url.

import type { FC } from "hono/jsx";
import { Layout } from "./Layout";

export const LoginPage: FC<{ error?: string; username?: string }> = ({ error, username }) => (
  <Layout title="Log in">
    <main class="container-narrow">
      <div class="panel stack">
        <h1>Log in</h1>
        {error && <p class="message message-error">{error}</p>}
        <form method="post" action="/auth/login" class="stack">
          <div class="field">
            <label for="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              required
              autocomplete="username"
              value={username ?? ""}
            />
          </div>
          <div class="field">
            <label for="password">Password</label>
            <input type="password" id="password" name="password" required autocomplete="current-password" />
          </div>
          <button type="submit" class="btn">
            Log in
          </button>
        </form>
        <p class="text-sm">
          Don't have an account? <a href="/auth/signup">Sign up</a>
        </p>
      </div>
    </main>
  </Layout>
);

export type SignupFieldErrors = Partial<Record<"username" | "email" | "password", string>>;

export const SignupPage: FC<{
  errors?: SignupFieldErrors;
  values?: { username?: string; email?: string; name?: string };
}> = ({ errors = {}, values = {} }) => (
  <Layout title="Sign up">
    <main class="container-narrow">
      <div class="panel stack">
        <h1>Sign up</h1>
        <p class="text-muted text-sm">
          Create a teacher account. Students join a class via an invite or join code, not this form.
        </p>
        <form method="post" action="/auth/signup" class="stack">
          <div class="field">
            <label for="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              required
              autocomplete="username"
              value={values.username ?? ""}
              aria-invalid={errors.username ? "true" : undefined}
            />
            {errors.username && <p class="field-error">{errors.username}</p>}
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
            <label for="name">
              Name <span class="text-muted">(optional)</span>
            </label>
            <input type="text" id="name" name="name" autocomplete="name" value={values.name ?? ""} />
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
            Sign up
          </button>
        </form>
        <p class="text-sm">
          Already have an account? <a href="/auth/login">Log in</a>
        </p>
      </div>
    </main>
  </Layout>
);

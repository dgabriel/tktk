// Public invite-acceptance page (GET/POST /invites/:token) -- no auth, no
// hx-* attributes, same reasoning as Auth.tsx/Classes.tsx (plain browser
// POST/redirect, never hit via hx-push-url).

import type { FC } from "hono/jsx";
import { Layout } from "./Layout";

export type InviteAcceptFieldErrors = Partial<Record<"username" | "password", string>>;
export type InviteAcceptFormValues = { username?: string; name?: string };

export type InviteAcceptPageProps =
  | { state: "not_found" }
  | { state: "expired" }
  | { state: "accepted" }
  | { state: "revoked" }
  | { state: "conflict" }
  | { state: "existing_account"; email: string }
  | {
      state: "form";
      email: string;
      className: string;
      errors?: InviteAcceptFieldErrors;
      values?: InviteAcceptFormValues;
    };

export const InviteAcceptPage: FC<InviteAcceptPageProps> = (props) => {
  if (props.state === "not_found") {
    return (
      <Layout title="Invite not found">
        <main class="container-narrow">
          <div class="panel stack">
            <h1>Invite not found</h1>
            <p>This invite link isn't valid. Double check the link, or ask your teacher to resend it.</p>
          </div>
        </main>
      </Layout>
    );
  }

  if (props.state === "expired") {
    return (
      <Layout title="Invite expired">
        <main class="container-narrow">
          <div class="panel stack">
            <h1>Invite expired</h1>
            <p>This invite has expired. Ask your teacher to send you a new one.</p>
          </div>
        </main>
      </Layout>
    );
  }

  if (props.state === "revoked") {
    return (
      <Layout title="Invite revoked">
        <main class="container-narrow">
          <div class="panel stack">
            <h1>Invite revoked</h1>
            <p>This invite is no longer valid. Ask your teacher to send you a new one.</p>
          </div>
        </main>
      </Layout>
    );
  }

  if (props.state === "accepted") {
    return (
      <Layout title="Invite already used">
        <main class="container-narrow">
          <div class="panel stack">
            <h1>Invite already used</h1>
            <p>This invite has already been accepted.</p>
            <p class="text-sm">
              <a href="/auth/login">Log in</a>
            </p>
          </div>
        </main>
      </Layout>
    );
  }

  if (props.state === "conflict") {
    return (
      <Layout title="Invite already used">
        <main class="container-narrow">
          <div class="panel stack">
            <h1>Invite already used</h1>
            <p>This invite was just accepted (maybe in another tab). If that was you, log in below.</p>
            <p class="text-sm">
              <a href="/auth/login">Log in</a>
            </p>
          </div>
        </main>
      </Layout>
    );
  }

  if (props.state === "existing_account") {
    return (
      <Layout title="Account already exists">
        <main class="container-narrow">
          <div class="panel stack">
            <h1>You already have an account</h1>
            <p>{props.email} already has a tktk account. Log in to join this class.</p>
            <p class="text-sm">
              <a href="/auth/login">Log in</a>
            </p>
          </div>
        </main>
      </Layout>
    );
  }

  const { email, className, errors = {}, values = {} } = props;

  return (
    <Layout title={`Join ${className}`}>
      <main class="container-narrow">
        <div class="panel stack">
          <h1>Join {className}</h1>
          <p class="text-muted text-sm">Create your student account to accept this invite.</p>
          <form method="post" class="stack">
            <div class="field">
              <label for="email-display">Email</label>
              <input type="email" id="email-display" value={email} readonly disabled />
              <p class="field-hint">This invite is for {email}.</p>
            </div>
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
              Join class
            </button>
          </form>
        </div>
      </main>
    </Layout>
  );
};

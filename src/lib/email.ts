// Resend wrapper for transactional email (invite delivery -- CLAUDE.md:
// Resend is still used for invite delivery, just not for auth anymore, since
// auth is username/password now, not magic-link).
//
// RESEND_API_KEY isn't provisioned in this environment yet (see
// .dev.vars.example, still the placeholder value). Rather than block the
// whole invite flow on a dependency nobody can provide right now,
// sendInviteEmail degrades to logging the invite link to the console
// whenever the key looks unset/placeholder, so the rest of the flow (invite
// creation, acceptance, signup) keeps working end-to-end without a real
// Resend account. The real API-call path below is fully wired -- once a
// real key is set via `wrangler secret put RESEND_API_KEY` (or .dev.vars
// locally), this starts sending real email with no code change.

const RESEND_ENDPOINT = "https://api.resend.com/emails";
// Placeholder sender -- needs a Resend-verified sending domain before this
// can actually deliver mail; revisit once a real Resend account exists.
const FROM_ADDRESS = "tktk <invites@tktk.dev>";

function hasRealResendKey(key: string | undefined): key is string {
  return !!key && key.trim().length > 0 && key !== "replace-with-a-real-resend-key";
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export type SendInviteEmailInput = {
  to: string;
  inviteLink: string;
  className: string;
};

export async function sendInviteEmail(
  env: { RESEND_API_KEY: string },
  input: SendInviteEmailInput,
): Promise<void> {
  if (!hasRealResendKey(env.RESEND_API_KEY)) {
    console.log(`[dev] invite link for ${input.to}: ${input.inviteLink}`);
    return;
  }

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: input.to,
      subject: `You're invited to join ${input.className} on tktk`,
      html: `<p>You've been invited to join <strong>${escapeHtml(input.className)}</strong> on tktk.</p><p><a href="${input.inviteLink}">Accept your invite</a></p>`,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API error (${res.status}): ${body}`);
  }
}

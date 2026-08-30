// Stateless, signed-cookie sessions — no DB table, no KV namespace. See
// CLAUDE.md "Decisions made during scaffolding" for why (keeps the MVP on a
// single Cloudflare resource, D1, instead of introducing a second one).
//
// The cookie holds a base64url JSON payload plus an HMAC-SHA256 signature
// over that payload, keyed by SESSION_SECRET. `readSession` rejects a
// tampered or expired cookie by returning null — callers must treat null as
// "not logged in," never throw a hard error on a bad cookie.

import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Context } from "hono";

const COOKIE_NAME = "tktk_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type SessionPayload = {
  userId: string;
  email: string;
  role: "teacher" | "student";
  exp: number; // unix seconds
};

// Hono `Variables` generic for apps/middleware that read the session set by
// requireTeacher (src/lib/authGuard.ts) — shared here so both sides agree on
// the shape of `c.get("session")` / `c.set("session", ...)`.
export type Variables = {
  session: SessionPayload;
};

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await hmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return toBase64Url(new Uint8Array(signature));
}

export async function createSessionCookie(
  c: Context,
  secret: string,
  session: Omit<SessionPayload, "exp">,
): Promise<void> {
  const payload: SessionPayload = { ...session, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS };
  const payloadB64 = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await sign(payloadB64, secret);
  setCookie(c, COOKIE_NAME, `${payloadB64}.${signature}`, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function readSession(c: Context, secret: string): Promise<SessionPayload | null> {
  const raw = getCookie(c, COOKIE_NAME);
  if (!raw) return null;

  const [payloadB64, signature] = raw.split(".");
  if (!payloadB64 || !signature) return null;

  const expectedSignature = await sign(payloadB64, secret);
  if (expectedSignature !== signature) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(payloadB64))) as SessionPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function clearSessionCookie(c: Context): void {
  deleteCookie(c, COOKIE_NAME, { path: "/" });
}

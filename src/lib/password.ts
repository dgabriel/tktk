// Password hashing via Web Crypto's PBKDF2 -- natively supported in the
// Workers runtime (same SubtleCrypto API session.ts uses for HMAC), no
// external dependency needed. Not bcrypt/argon2: those aren't available
// through SubtleCrypto and a pure-JS implementation is both slower and a
// dependency Workers doesn't need for an MVP. Revisit if a real security
// review calls for it.

const ITERATIONS = 210_000; // OWASP 2023 PBKDF2-SHA256 minimum recommendation
const KEY_LENGTH_BITS = 256;

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

async function deriveBits(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    KEY_LENGTH_BITS,
  );
  return new Uint8Array(bits);
}

// Stored format: pbkdf2$<iterations>$<salt-b64url>$<hash-b64url>
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveBits(password, salt);
  return `pbkdf2$${ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const [, iterationsStr, saltB64, hashB64] = parts as [string, string, string, string];

  const iterations = Number(iterationsStr);
  const salt = fromBase64Url(saltB64);
  const expected = fromBase64Url(hashB64);
  if (!Number.isFinite(iterations) || salt.length === 0 || expected.length === 0) return false;

  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const actual = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
      keyMaterial,
      KEY_LENGTH_BITS,
    ),
  );

  if (actual.length !== expected.length) return false;
  // Constant-time comparison -- don't leak timing info about how much of
  // the hash matched.
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i]! ^ expected[i]!;
  return diff === 0;
}

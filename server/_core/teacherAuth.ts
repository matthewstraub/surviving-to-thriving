import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Teacher access is a single shared password. This module keeps three
 * properties that the previous inline check did not:
 *
 *   1. Production refuses to start without TEACHER_PASSWORD, rather than
 *      silently falling back to a default that is public in this repository.
 *   2. Signing in returns a short-lived signed token rather than the password
 *      itself, so the credential sitting in localStorage is not the password.
 *   3. Comparisons are constant-time.
 *
 * The token is signed with the password as the HMAC key, which makes it
 * stateless (it survives the free tier's frequent restarts) and means that
 * changing the password immediately invalidates every existing session.
 */

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

/** Only ever used outside production, and only when nothing is configured. */
const DEV_FALLBACK_PASSWORD = "thriving2024";

/**
 * Call once at startup. Throws in production when the password is missing so
 * the deploy fails loudly instead of coming up with a known-public password.
 */
export function assertTeacherPasswordConfigured(): void {
  if (process.env.TEACHER_PASSWORD) return;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "TEACHER_PASSWORD is not set. Refusing to start in production rather than " +
        "fall back to a default password that is public in this repository. " +
        "Set TEACHER_PASSWORD in the Render environment and redeploy."
    );
  }

  console.warn(
    "[Auth] TEACHER_PASSWORD is not set — falling back to the development " +
      "password. This is for local development only."
  );
}

function teacherPassword(): string {
  return process.env.TEACHER_PASSWORD || DEV_FALLBACK_PASSWORD;
}

/** Constant-time comparison. Hashing first keeps it constant-time across
 *  differing lengths, which a raw timingSafeEqual cannot do. */
function equals(a: string, b: string): boolean {
  return timingSafeEqual(
    createHash("sha256").update(a, "utf8").digest(),
    createHash("sha256").update(b, "utf8").digest()
  );
}

function sign(payload: string): string {
  return createHmac("sha256", teacherPassword())
    .update(payload)
    .digest("base64url");
}

export function isCorrectPassword(candidate: string): boolean {
  return equals(candidate, teacherPassword());
}

/** Issues a token of the form `<expiryMs>.<signature>`. */
export function issueTeacherToken(now: number = Date.now()): {
  token: string;
  expiresAt: number;
} {
  const expiresAt = now + SESSION_TTL_MS;
  const payload = String(expiresAt);
  return { token: `${payload}.${sign(payload)}`, expiresAt };
}

export function isValidTeacherToken(
  token: string,
  now: number = Date.now()
): boolean {
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return false;

  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!signature || !equals(signature, sign(payload))) return false;

  const expiresAt = Number(payload);
  return Number.isFinite(expiresAt) && now < expiresAt;
}

/** Pulls a bearer token out of an Authorization header, if present. */
export function readBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, ...rest] = header.split(" ");
  if (scheme.toLowerCase() !== "bearer") return null;
  const token = rest.join(" ").trim();
  return token || null;
}

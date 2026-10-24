import crypto from "crypto"

/**
 * Signed session tokens.
 *
 * Format: v1.<base64url(JSON payload)>.<base64url(HMAC-SHA256)>
 * Payload: { uid: string, u?: string, exp: number (unix seconds) }
 *
 * The same token is used as the `insta_session` cookie (web) and can be sent
 * as `Authorization: Bearer <token>` (mobile / API clients).
 *
 * Requires SESSION_SECRET (>= 32 chars). Generate with: openssl rand -base64 48
 */

export const SESSION_COOKIE = "insta_session"
const VERSION = "v1"

export interface SessionPayload {
  uid: string
  u?: string
  /** Set when a teammate is working inside someone else's account: the teammate's OWN user id. */
  mb?: string
  exp: number
}

function getSecret(): Buffer | null {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) return null
  return Buffer.from(secret, "utf8")
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url")
}

function sign(data: string, secret: Buffer): string {
  return b64url(crypto.createHmac("sha256", secret).update(data).digest())
}

export function createSessionToken(
  userId: string,
  username: string | undefined,
  maxAgeSeconds: number,
  memberId?: string,
): string {
  const secret = getSecret()
  if (!secret) {
    throw new Error("SESSION_SECRET is missing or shorter than 32 characters")
  }
  const payload: SessionPayload = {
    uid: String(userId),
    u: username,
    ...(memberId ? { mb: String(memberId) } : {}),
    exp: Math.floor(Date.now() / 1000) + maxAgeSeconds,
  }
  const body = b64url(JSON.stringify(payload))
  const data = `${VERSION}.${body}`
  return `${data}.${sign(data, secret)}`
}

/** Returns the payload if the token is genuine and unexpired, otherwise null. */
export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null
  const secret = getSecret()
  if (!secret) return null

  const parts = token.split(".")
  if (parts.length !== 3 || parts[0] !== VERSION) return null

  const data = `${parts[0]}.${parts[1]}`
  const expected = Buffer.from(sign(data, secret))
  const actual = Buffer.from(parts[2])
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    return null
  }

  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as SessionPayload
    if (!payload?.uid || typeof payload.exp !== "number") return null
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

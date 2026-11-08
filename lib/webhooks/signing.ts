/**
 * HMAC-SHA256 signing for outbound webhooks (pure).
 *
 * Who calls this: lib/webhooks/events.ts when delivering; receivers (and docs/SHEETS.md) use the
 * same recipe to verify.
 * Header:  X-Celra-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">
 * The timestamp is inside the signed text so a captured request cannot be replayed later:
 * receivers should reject timestamps older than 5 minutes.
 */
import crypto from "node:crypto"

export function signPayload(secret: string, body: string, timestampSec: number): string {
  const v1 = crypto.createHmac("sha256", secret).update(`${timestampSec}.${body}`).digest("hex")
  return `t=${timestampSec},v1=${v1}`
}

/** Receiver-side check (also used in tests). toleranceSec bounds replay. */
export function verifySignature(
  secret: string,
  body: string,
  header: string | null | undefined,
  nowSec: number = Math.floor(Date.now() / 1000),
  toleranceSec = 300,
): boolean {
  if (!header) return false
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]))
  const t = Number(parts.t)
  if (!Number.isFinite(t) || !parts.v1 || Math.abs(nowSec - t) > toleranceSec) return false
  const expected = Buffer.from(signPayload(secret, body, t))
  const actual = Buffer.from(header)
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
}

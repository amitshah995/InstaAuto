/**
 * Service-to-service authentication for cron and hook routes.
 *
 * Who calls this: every /api/cron/*, /api/hooks/*, and /api/scheduler route handler.
 * Why it exists: these routes mutate data or send messages without a user session, so they must
 * be protected by a shared secret, compared in constant time and failing closed when unset.
 *
 * Accepted credentials (any one):
 *  - `Authorization: Bearer <CRON_SECRET>`   (Vercel Cron and external pingers)
 *  - `Authorization: Bearer <API_SECRET_KEY>` (legacy manual calls)
 *  - `x-api-secret: <API_SECRET_KEY>`         (legacy /api/hooks callers, kept so nothing breaks)
 *
 * No Next.js imports here on purpose, so the logic is unit-testable with plain node.
 */
import crypto from "crypto"

/** Constant-time string compare. Hashing first removes the length leak of timingSafeEqual. */
export function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest()
  const hb = crypto.createHash("sha256").update(b).digest()
  return crypto.timingSafeEqual(ha, hb)
}

type HeaderGetter = { get(name: string): string | null }

/** True when the request carries a valid service secret. Unset secrets never match (fail closed). */
export function isServiceAuthorized(
  headers: HeaderGetter,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const cron = env.CRON_SECRET || ""
  const api = env.API_SECRET_KEY || ""
  const auth = headers.get("authorization") || ""
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : ""
  const legacy = headers.get("x-api-secret") || ""

  let ok = false
  // Evaluate every candidate (no early return) so timing does not reveal which secret matched.
  if (cron && bearer) ok = safeEqual(bearer, cron) || ok
  if (api && bearer) ok = safeEqual(bearer, api) || ok
  if (api && legacy) ok = safeEqual(legacy, api) || ok
  return ok
}

import { type NextRequest } from "next/server"
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session"

/**
 * Rollout flags (all read at request time):
 *
 *  SESSION_ACCEPT_LEGACY  default ON. Accepts the old unsigned JSON cookie so
 *                         existing logged-in users are not signed out on
 *                         deploy. Set to "0" once everyone has re-logged in.
 *                         While ON, the session is NOT trustworthy.
 *
 *  AUTH_ENFORCE           default OFF. When "1", routes that used to trust a
 *                         client-supplied userId (query/body) require a valid
 *                         session and reject a mismatching userId. Turn on
 *                         after the Android app sends Authorization: Bearer.
 */

function acceptLegacy(): boolean {
  return process.env.SESSION_ACCEPT_LEGACY !== "0"
}

function enforce(): boolean {
  return process.env.AUTH_ENFORCE === "1"
}

export function isEnforced(): boolean {
  return enforce()
}

/** Verified user id from the signed cookie or Bearer token (or legacy cookie if allowed). */
export function getSessionUserId(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization")
  if (authHeader?.startsWith("Bearer ")) {
    const payload = verifySessionToken(authHeader.slice(7).trim())
    if (payload) return payload.uid
  }

  const raw = request.cookies.get(SESSION_COOKIE)?.value
  if (!raw) return null

  const signed = verifySessionToken(raw)
  if (signed) return signed.uid

  if (acceptLegacy()) {
    try {
      const session = JSON.parse(raw)
      return session?.userId ? String(session.userId) : null
    } catch {
      return null
    }
  }
  return null
}

export type AuthResult =
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403; error: string }

/**
 * For routes that historically took `userId` from the query string or body.
 *
 * - AUTH_ENFORCE=1: session required; a different claimed userId is a 403.
 * - otherwise: falls back to the claimed userId (legacy behaviour, logged),
 *   but a valid session always wins over a claimed id.
 */
export function authorizeUser(request: NextRequest, claimedUserId?: string | null): AuthResult {
  const sessionUserId = getSessionUserId(request)
  const claimed = claimedUserId ? String(claimedUserId) : null

  if (sessionUserId) {
    if (claimed && claimed !== sessionUserId) {
      return { ok: false, status: 403, error: "Forbidden" }
    }
    return { ok: true, userId: sessionUserId }
  }

  if (enforce()) {
    return { ok: false, status: 401, error: "Not authenticated" }
  }

  if (claimed) {
    console.warn(`[auth] legacy unauthenticated userId used on ${request.nextUrl.pathname}`)
    return { ok: true, userId: claimed }
  }
  return { ok: false, status: 401, error: "Missing userId" }
}

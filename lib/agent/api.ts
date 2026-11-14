/**
 * Small helpers shared by the app/api/ai-agent/* routes.
 * Who calls this: those routes. Why: one place for "who is calling" so no route forgets to scope by the session user.
 */
import { type NextRequest, NextResponse } from "next/server"
import { authorizeUser } from "@/lib/auth"
import { slideWindow } from "./rate.ts"

export function agentUser(request: NextRequest, claimed?: string | null): { ok: true; userId: string } | { ok: false; res: NextResponse } {
  const auth = authorizeUser(request, claimed ?? request.nextUrl.searchParams.get("userId"))
  if (!auth.ok) return { ok: false, res: NextResponse.json({ error: auth.error }, { status: auth.status }) }
  return { ok: true, userId: auth.userId }
}

export const NOT_SETUP = { error: "The AI Sales Agent is not set up yet (run migrations 31 and 32)." }

/** Missing-table errors become a friendly message; anything else is logged WITHOUT request data. */
export function failure(tag: string, e: unknown) {
  const msg = (e as Error)?.message || ""
  console.error(`[ai-agent] ${tag}:`, msg.slice(0, 200))
  const missing = /media_knowledge|agent_conversations|agent_settings|lead_events|lead_status|agent_kb_|match_agent_chunks|type "vector"/.test(msg)
  return NextResponse.json(missing ? NOT_SETUP : { error: "Something went wrong. Please try again." }, { status: 500 })
}

/**
 * Reads a JSON body with a size cap (characters). Returns { body: {} } for an unreadable body (like request.json().catch) and
 * { tooBig: true } when it is larger than maxChars; a declared Content-Length over the cap is refused without reading it.
 * Who calls this: the app/api/ai-agent/kb routes (a pasted document is at most 60,000 characters, so 700,000 is generous).
 */
export async function readJsonLimited(request: NextRequest, maxChars: number): Promise<{ body: any; tooBig: false } | { tooBig: true }> {
  const declared = Number(request.headers.get("content-length"))
  if (Number.isFinite(declared) && declared > maxChars * 4) return { tooBig: true }
  const raw = await request.text().catch(() => "")
  if (raw.length > maxChars) return { tooBig: true }
  try {
    return { body: raw ? JSON.parse(raw) : {}, tooBig: false }
  } catch {
    return { body: {}, tooBig: false }
  }
}
export const tooBigResponse = () => NextResponse.json({ error: "That request is too large." }, { status: 413 })

const stamps = new Map<string, number[]>()
/** Per-account, per-bucket sliding window (best effort per server instance, like lib/agent/rate.ts). True = allowed. */
export function rateAllowed(userId: string, bucket: string, max: number, windowMs = 60_000): boolean {
  const key = `${bucket}:${userId}`
  const w = slideWindow(stamps.get(key) ?? [], Date.now(), max, windowMs)
  if (stamps.size > 5000) stamps.clear() // bounded memory
  stamps.set(key, w.stamps)
  return w.allowed
}
export const tooManyResponse = () => NextResponse.json({ error: "Too many requests. Please wait a minute and try again." }, { status: 429 })

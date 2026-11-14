/**
 * Small helpers shared by the app/api/ai-agent/* routes.
 * Who calls this: those routes. Why: one place for "who is calling" so no route forgets to scope by the session user.
 */
import { type NextRequest, NextResponse } from "next/server"
import { authorizeUser } from "@/lib/auth"

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

import { type NextRequest, NextResponse } from "next/server"
import { rawQuery } from "@/lib/supabase-server"
import { SESSION_COOKIE, createSessionToken } from "@/lib/session"
import { ACTING_SESSION_SECONDS, OWN_SESSION_SECONDS, getTeamCtx, isMember } from "@/lib/team"

/**
 * Switch between your own account and a workspace you were invited to.
 * Body: { ownerId } to enter that workspace, or {} to return to your own account.
 * The session is re-signed on the server, so the choice cannot be forged from the browser.
 */
export async function POST(request: NextRequest) {
  const ctx = getTeamCtx(request)
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const { ownerId } = await request.json().catch(() => ({ ownerId: null }))

  try {
    let targetId = ctx.selfId
    let acting = false
    if (ownerId && String(ownerId) !== ctx.selfId) {
      if (!(await isMember(String(ownerId), ctx.selfId))) return NextResponse.json({ error: "You are not on that team." }, { status: 403 })
      targetId = String(ownerId)
      acting = true
    }
    const [u] = await rawQuery<{ username: string }>(`SELECT username FROM users WHERE id=$1`, [targetId])
    if (!u) return NextResponse.json({ error: "Account not found" }, { status: 404 })

    const maxAge = acting ? ACTING_SESSION_SECONDS : OWN_SESSION_SECONDS
    const token = createSessionToken(targetId, u.username, maxAge, acting ? ctx.selfId : undefined)
    const res = NextResponse.json({ userId: targetId, username: u.username, acting, sessionToken: token })
    res.cookies.set(SESSION_COOKIE, token, {
      path: "/",
      maxAge,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
    })
    return res
  } catch (e: any) {
    console.error("[team] switch", e)
    return NextResponse.json({ error: e?.message || "Could not switch" }, { status: 500 })
  }
}
  

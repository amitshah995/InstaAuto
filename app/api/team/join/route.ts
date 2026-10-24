import { type NextRequest, NextResponse } from "next/server"
import { rawQuery } from "@/lib/supabase-server"
import { getTeamCtx } from "@/lib/team"

/** A logged-in person accepts an invite code. */
export async function POST(request: NextRequest) {
  const ctx = getTeamCtx(request)
  if (!ctx) return NextResponse.json({ error: "Please log in with Instagram first." }, { status: 401 })
  const { code } = await request.json().catch(() => ({ code: "" }))
  if (!code || typeof code !== "string") return NextResponse.json({ error: "Missing invite code" }, { status: 400 })
  try {
    // Atomically claim the invite so it can only be used once.
    const claimed = await rawQuery<{ owner_id: string }>(
      `UPDATE team_invites SET used_by=$2 WHERE code=$1 AND used_by IS NULL AND expires_at > now() AND owner_id <> $2 RETURNING owner_id::text AS owner_id`,
      [code, ctx.selfId],
    )
    if (!claimed.length) return NextResponse.json({ error: "This invite is invalid, expired, already used, or is your own account." }, { status: 400 })
    await rawQuery(`INSERT INTO team_members (owner_id, member_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [claimed[0].owner_id, ctx.selfId])
    const [owner] = await rawQuery(`SELECT id::text AS id, username FROM users WHERE id=$1`, [claimed[0].owner_id])
    return NextResponse.json({ ok: true, owner })
  } catch (e) {
    console.error("[team] join", e)
    return NextResponse.json({ error: "Team access is not set up yet (run migration 25)." }, { status: 500 })
  }
}

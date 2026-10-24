import { type NextRequest, NextResponse } from "next/server"
import { rawQuery } from "@/lib/supabase-server"
import { getSiteUrl } from "@/lib/site"
import { getTeamCtx, makeInviteCode } from "@/lib/team"

const NOT_SETUP = { error: "Team access is not set up yet (run migration 25)." }

export async function GET(request: NextRequest) {
  const ctx = getTeamCtx(request)
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  try {
    const [members, invites, workspaces, [self]] = await Promise.all([
      ctx.acting
        ? Promise.resolve([])
        : rawQuery(`SELECT u.id::text AS id, u.username, t.created_at FROM team_members t JOIN users u ON u.id=t.member_id WHERE t.owner_id=$1 ORDER BY t.created_at`, [ctx.accountId]),
      ctx.acting
        ? Promise.resolve([])
        : rawQuery(`SELECT code, expires_at FROM team_invites WHERE owner_id=$1 AND used_by IS NULL AND expires_at > now() ORDER BY created_at DESC`, [ctx.accountId]),
      rawQuery(`SELECT u.id::text AS id, u.username FROM team_members t JOIN users u ON u.id=t.owner_id WHERE t.member_id=$1`, [ctx.selfId]),
      rawQuery(`SELECT id::text AS id, username FROM users WHERE id=$1`, [ctx.selfId]),
    ])
    const [account] = await rawQuery(`SELECT id::text AS id, username FROM users WHERE id=$1`, [ctx.accountId])
    return NextResponse.json({
      acting: ctx.acting,
      self,
      account,
      members,
      invites: (invites as any[]).map((i) => ({ ...i, url: `${getSiteUrl()}/team/join/${i.code}` })),
      workspaces,
    })
  } catch (e) {
    console.error("[team] GET", e)
    return NextResponse.json(NOT_SETUP, { status: 500 })
  }
}

/** Create an invite link (owner only). */
export async function POST(request: NextRequest) {
  const ctx = getTeamCtx(request)
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (ctx.acting) return NextResponse.json({ error: "Only the account owner can invite people." }, { status: 403 })
  try {
    const [{ n }] = await rawQuery<{ n: number }>(
      `SELECT (SELECT COUNT(*) FROM team_members WHERE owner_id=$1) + (SELECT COUNT(*) FROM team_invites WHERE owner_id=$1 AND used_by IS NULL AND expires_at > now()) AS n`,
      [ctx.accountId],
    )
    if (Number(n) >= 10) return NextResponse.json({ error: "You can have up to 10 teammates and open invites." }, { status: 400 })
    const code = makeInviteCode()
    await rawQuery(`INSERT INTO team_invites (code, owner_id) VALUES ($1,$2)`, [code, ctx.accountId])
    return NextResponse.json({ code, url: `${getSiteUrl()}/team/join/${code}` })
  } catch (e) {
    console.error("[team] POST", e)
    return NextResponse.json(NOT_SETUP, { status: 500 })
  }
}

/** Remove a teammate or cancel an invite (owner only). A member can also leave a workspace with ?leave=<ownerId>. */
export async function DELETE(request: NextRequest) {
  const ctx = getTeamCtx(request)
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const q = request.nextUrl.searchParams
  try {
    const leave = q.get("leave")
    if (leave) {
      await rawQuery(`DELETE FROM team_members WHERE owner_id=$1 AND member_id=$2`, [leave, ctx.selfId])
      return NextResponse.json({ ok: true })
    }
    if (ctx.acting) return NextResponse.json({ error: "Only the account owner can change the team." }, { status: 403 })
    const member = q.get("member")
    const invite = q.get("invite")
    if (member) await rawQuery(`DELETE FROM team_members WHERE owner_id=$1 AND member_id=$2`, [ctx.accountId, member])
    else if (invite) await rawQuery(`DELETE FROM team_invites WHERE owner_id=$1 AND code=$2`, [ctx.accountId, invite])
    else return NextResponse.json({ error: "Nothing to remove" }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[team] DELETE", e)
    return NextResponse.json(NOT_SETUP, { status: 500 })
  }
}

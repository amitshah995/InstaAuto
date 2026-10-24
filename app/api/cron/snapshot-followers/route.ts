import { type NextRequest, NextResponse } from "next/server"
import { rawQuery } from "@/lib/supabase-server"
import { recordFollowerSnapshot } from "@/lib/reports"

export const maxDuration = 60

/** Daily: store each connected account's follower count so growth can be charted. */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization")
  const ok =
    (process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`) ||
    (process.env.API_SECRET_KEY && auth === `Bearer ${process.env.API_SECRET_KEY}`)
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const users = await rawQuery<{ id: number; access_token: string }>(
    `SELECT id, access_token FROM users WHERE access_token IS NOT NULL AND access_token <> 'REVOKED' LIMIT 200`,
  )
  let stored = 0
  for (const u of users) {
    if ((await recordFollowerSnapshot(u.id, u.access_token)) !== null) stored++
  }
  return NextResponse.json({ users: users.length, stored })
}

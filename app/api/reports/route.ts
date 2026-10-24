import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { rawQuery } from "@/lib/supabase-server"
import { getSessionUserId } from "@/lib/auth"
import { getSiteUrl } from "@/lib/site"
import { getFollowerSeries, getReportStats, makeReportSlug, recordFollowerSnapshot } from "@/lib/reports"

export async function GET(request: NextRequest) {
  const userId = getSessionUserId(request)
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  // Make sure today's point exists so the chart is never empty for a connected account.
  try {
    const [u] = await rawQuery<{ access_token: string }>(`SELECT access_token FROM users WHERE id=$1`, [userId])
    if (u?.access_token && u.access_token !== "REVOKED") await recordFollowerSnapshot(userId, u.access_token)
  } catch {}

  let share: { slug: string; enabled: boolean; title: string | null } | null = null
  let setup = true
  try {
    const rows = await rawQuery<{ slug: string; enabled: boolean; title: string | null }>(
      `SELECT slug, enabled, title FROM report_shares WHERE user_id=$1`,
      [userId],
    )
    share = rows[0] || null
  } catch {
    setup = false
  }
  const [series, stats] = await Promise.all([getFollowerSeries(userId, 90), getReportStats(userId, 30)])
  return NextResponse.json({ setup, series, stats, share, url: share ? `${getSiteUrl()}/reports/${share.slug}` : null })
}

const Body = z.object({ enabled: z.boolean().optional(), title: z.string().trim().max(80).optional() })

export async function POST(request: NextRequest) {
  const userId = getSessionUserId(request)
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const parsed = Body.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  try {
    const rows = await rawQuery<{ slug: string; enabled: boolean; title: string | null }>(
      `INSERT INTO report_shares (user_id, slug, enabled, title) VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id) DO UPDATE SET enabled = COALESCE($5, report_shares.enabled), title = COALESCE($6, report_shares.title)
       RETURNING slug, enabled, title`,
      [userId, makeReportSlug(), parsed.data.enabled ?? true, parsed.data.title ?? null, parsed.data.enabled ?? null, parsed.data.title ?? null],
    )
    return NextResponse.json({ share: rows[0], url: `${getSiteUrl()}/reports/${rows[0].slug}` })
  } catch (e) {
    console.error("[reports] POST error:", e)
    return NextResponse.json({ error: "Reports are not set up yet (run migration 24)." }, { status: 500 })
  }
}

import { type NextRequest, NextResponse } from "next/server"
import { rawQuery } from "@/lib/supabase-server"
import { REPORTS_TO_DISABLE, visitorHash } from "@/lib/links/core"

// Public: anyone can report a short link as abusive. Distinct reporters only;
// REPORTS_TO_DISABLE different people disable it until the owner is reviewed.
const recent = new Map<string, number[]>()
function limited(key: string) {
  const now = Date.now()
  const hits = (recent.get(key) || []).filter((t) => now - t < 3600_000)
  if (hits.length >= 5) return true
  hits.push(now)
  recent.set(key, hits)
  return false
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const slug = typeof body?.slug === "string" ? body.slug.toLowerCase() : ""
  if (!/^[a-z0-9]{4,12}$/.test(slug)) return NextResponse.json({ error: "Invalid link" }, { status: 400 })
  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "0.0.0.0"
  if (limited(ip)) return NextResponse.json({ error: "Too many reports, try later" }, { status: 429 })
  try {
    const rows = await rawQuery<{ id: string }>(`SELECT id FROM links WHERE slug = $1`, [slug])
    if (!rows[0]) return NextResponse.json({ ok: true }) // do not reveal whether a slug exists
    const who = visitorHash(ip, request.headers.get("user-agent") || "", "reports")
    await rawQuery(`INSERT INTO link_reports (link_id, visitor_hash) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [rows[0].id, who])
    await rawQuery(
      `UPDATE links SET disabled = TRUE WHERE id = $1 AND (SELECT COUNT(*) FROM link_reports WHERE link_id = $1) >= $2`,
      [rows[0].id, REPORTS_TO_DISABLE],
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[links] report error:", (e as Error)?.message)
    return NextResponse.json({ error: "Could not record report" }, { status: 500 })
  }
}

import { type NextRequest, NextResponse } from "next/server"
import { rawQuery } from "@/lib/supabase-server"
import { isBotUserAgent, visitorHash } from "@/lib/links/core"

export const dynamic = "force-dynamic"

const text = (body: string, status: number) =>
  new NextResponse(body, { status, headers: { "content-type": "text/plain; charset=utf-8", "x-robots-tag": "noindex" } })

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug: raw } = await params
  const slug = raw.toLowerCase()
  if (!/^[a-z0-9]{4,12}$/.test(slug)) return text("Link not found", 404)

  try {
    const rows = await rawQuery<{ id: string; url: string; disabled: boolean }>(
      `SELECT id, url, disabled FROM links WHERE slug = $1 LIMIT 1`,
      [slug],
    )
    const link = rows[0]
    if (!link) return text("Link not found", 404)
    if (link.disabled) return text("This link has been disabled.", 410)

    const ua = request.headers.get("user-agent") || ""
    const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "0.0.0.0"
    const source = (request.nextUrl.searchParams.get("s") || "").slice(0, 40).replace(/[^a-z0-9_\-:.]/gi, "") || null
    try {
      await rawQuery(
        `INSERT INTO link_clicks (link_id, source, visitor_hash, is_bot) VALUES ($1, $2, $3, $4)`,
        [link.id, source, visitorHash(ip, ua), isBotUserAgent(ua)],
      )
    } catch (e) {
      console.error("[links] click not recorded:", (e as Error)?.message) // never block the visitor
    }

    return new NextResponse(null, {
      status: 302,
      headers: { location: link.url, "cache-control": "no-store", "x-robots-tag": "noindex", "referrer-policy": "no-referrer" },
    })
  } catch (e) {
    console.error("[links] redirect failed:", (e as Error)?.message)
    return text("Something went wrong", 500)
  }
}

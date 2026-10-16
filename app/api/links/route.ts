import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { rawQuery } from "@/lib/supabase-server"
import { getSessionUserId } from "@/lib/auth"
import { MAX_LINKS_PER_USER, makeSlug, siteBase, validateDestination } from "@/lib/links/core"

const CreateSchema = z.object({
  title: z.string().trim().min(1).max(80),
  url: z.string(),
  network: z.string().trim().max(40).optional().nullable(),
  disclose: z.boolean().optional(),
})
const PatchSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(80).optional(),
  disabled: z.boolean().optional(),
  disclose: z.boolean().optional(),
})

const unauthorized = () => NextResponse.json({ error: "Not authenticated" }, { status: 401 })

export async function GET(request: NextRequest) {
  const userId = getSessionUserId(request)
  if (!userId) return unauthorized()
  try {
    const rows = await rawQuery(
      `SELECT l.id, l.slug, l.title, l.url, l.network, l.disclose, l.disabled, l.created_at,
              COUNT(c.id) FILTER (WHERE c.is_bot = FALSE)::int AS clicks_total,
              COUNT(c.id) FILTER (WHERE c.is_bot = FALSE AND c.clicked_at > now() - interval '7 days')::int AS clicks_7d,
              COUNT(DISTINCT c.visitor_hash) FILTER (WHERE c.is_bot = FALSE AND c.clicked_at > now() - interval '7 days')::int AS visitors_7d
       FROM links l LEFT JOIN link_clicks c ON c.link_id = l.id
       WHERE l.user_id = $1
       GROUP BY l.id ORDER BY l.created_at DESC LIMIT $2`,
      [userId, MAX_LINKS_PER_USER],
    )
    return NextResponse.json({ base: siteBase(), links: rows })
  } catch (e) {
    console.error("[links] GET error:", e)
    return NextResponse.json({ error: "Links are not set up yet (run migration 15)." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const userId = getSessionUserId(request)
  if (!userId) return unauthorized()
  const parsed = CreateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Please give a title and a link" }, { status: 400 })
  const dest = validateDestination(parsed.data.url)
  if (!dest.ok) return NextResponse.json({ error: dest.error }, { status: 400 })

  try {
    const [{ n }] = await rawQuery<{ n: number }>(`SELECT COUNT(*)::int AS n FROM links WHERE user_id = $1`, [userId])
    if (n >= MAX_LINKS_PER_USER) return NextResponse.json({ error: `You can keep up to ${MAX_LINKS_PER_USER} links` }, { status: 400 })

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const rows = await rawQuery(
          `INSERT INTO links (user_id, slug, title, url, network, disclose) VALUES ($1,$2,$3,$4,$5,$6)
           RETURNING id, slug, title, url, network, disclose, disabled, created_at`,
          [userId, makeSlug(), parsed.data.title, dest.url, parsed.data.network || null, parsed.data.disclose ?? true],
        )
        return NextResponse.json({ link: rows[0], base: siteBase() })
      } catch (e: any) {
        if (e?.code !== "23505") throw e // only retry a slug collision
      }
    }
    return NextResponse.json({ error: "Could not create a link, try again" }, { status: 500 })
  } catch (e) {
    console.error("[links] POST error:", e)
    return NextResponse.json({ error: "Links are not set up yet (run migration 15)." }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const userId = getSessionUserId(request)
  if (!userId) return unauthorized()
  const parsed = PatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  const { id, title, disabled, disclose } = parsed.data
  try {
    const rows = await rawQuery(
      `UPDATE links SET title = COALESCE($3, title), disabled = COALESCE($4, disabled), disclose = COALESCE($5, disclose)
       WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, userId, title ?? null, disabled ?? null, disclose ?? null],
    )
    if (rows.length === 0) return NextResponse.json({ error: "Link not found" }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[links] PATCH error:", e)
    return NextResponse.json({ error: "Update failed" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const userId = getSessionUserId(request)
  if (!userId) return unauthorized()
  const id = request.nextUrl.searchParams.get("id")
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  try {
    const rows = await rawQuery(`DELETE FROM links WHERE id = $1 AND user_id = $2 RETURNING id`, [id, userId])
    if (rows.length === 0) return NextResponse.json({ error: "Link not found" }, { status: 404 })
    await rawQuery(`DELETE FROM link_clicks WHERE link_id = $1`, [id])
    await rawQuery(`DELETE FROM link_reports WHERE link_id = $1`, [id])
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[links] DELETE error:", e)
    return NextResponse.json({ error: "Delete failed" }, { status: 500 })
  }
}

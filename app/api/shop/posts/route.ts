import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { rawQuery } from "@/lib/supabase-server"
import { getSessionUserId } from "@/lib/auth"
import { siteBase } from "@/lib/links/core"
import { cleanText, normalizeHandle, shopUrl } from "@/lib/shop/core"
import { MAX_CAPTION, MAX_IMAGES_PER_POST, MAX_POSTS_PER_USER, MAX_PRODUCTS_PER_POST, userMediaPrefix } from "@/lib/shop/media"
import { parseInstagramUrl } from "@/lib/shop/video"

const PostSchema = z.object({
  kind: z.enum(["images", "reel"]),
  caption: z.string().max(5000).optional().nullable(),
  images: z.array(z.string().max(1000)).max(MAX_IMAGES_PER_POST).optional(),
  reel_url: z.string().max(500).optional().nullable(),
  link_ids: z.array(z.string().uuid()).max(MAX_PRODUCTS_PER_POST).optional(),
})

const unauthorized = () => NextResponse.json({ error: "Not authenticated" }, { status: 401 })

export async function GET(request: NextRequest) {
  const userId = getSessionUserId(request)
  if (!userId) return unauthorized()
  try {
    const posts = await rawQuery(
      `SELECT id, kind, caption, images, reel_kind, reel_code, link_ids, created_at
         FROM shop_posts WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [userId, MAX_POSTS_PER_USER],
    )
    const clicks = await rawQuery<{ source: string; n: number }>(
      `SELECT c.source, COUNT(*)::int AS n
         FROM link_clicks c JOIN links l ON l.id = c.link_id
        WHERE l.user_id = $1 AND c.is_bot = FALSE AND c.source LIKE 'p:%'
        GROUP BY c.source`,
      [userId],
    )
    const byPost = new Map(clicks.map((c) => [c.source.slice(2), c.n]))
    const u = await rawQuery<{ username: string | null }>(`SELECT username FROM users WHERE id = $1 LIMIT 1`, [userId])
    const h = normalizeHandle(u[0]?.username ?? "")
    return NextResponse.json({
      base: siteBase(),
      handle: h.ok ? h.handle : null,
      shopUrl: h.ok ? shopUrl(siteBase(), h.handle) : null,
      posts: posts.map((p: any) => ({ ...p, clicks: byPost.get(p.id) ?? 0 })),
    })
  } catch (e) {
    console.error("[shop-posts] GET error:", e)
    return NextResponse.json({ error: "Posts are not set up yet (run migration 19)." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const userId = getSessionUserId(request)
  if (!userId) return unauthorized()
  const parsed = PostSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  const d = parsed.data
  const caption = cleanText(d.caption, MAX_CAPTION) || null

  let images: string[] = []
  let reelKind: string | null = null
  let reelCode: string | null = null
  if (d.kind === "images") {
    images = d.images ?? []
    if (images.length === 0) return NextResponse.json({ error: "Add at least one image" }, { status: 400 })
    const prefix = userMediaPrefix(userId)
    // Only images uploaded through our own storage by this user are accepted.
    if (!prefix || images.some((u) => !u.startsWith(prefix) || u.includes(".."))) {
      return NextResponse.json({ error: "Images must be uploaded through the Studio" }, { status: 400 })
    }
  } else {
    const ig = parseInstagramUrl(d.reel_url)
    if (!ig.ok) return NextResponse.json({ error: ig.error }, { status: 400 })
    reelKind = ig.media.kind
    reelCode = ig.media.shortcode
  }

  try {
    const [{ n }] = await rawQuery<{ n: number }>(`SELECT COUNT(*)::int AS n FROM shop_posts WHERE user_id = $1`, [userId])
    if (n >= MAX_POSTS_PER_USER) return NextResponse.json({ error: `You can keep up to ${MAX_POSTS_PER_USER} posts` }, { status: 400 })

    // Keep only tagged products that really belong to this user, in the order picked.
    const wanted = d.link_ids ?? []
    let linkIds: string[] = []
    if (wanted.length) {
      const own = await rawQuery<{ id: string }>(`SELECT id FROM links WHERE user_id = $1 AND id = ANY($2::uuid[])`, [userId, wanted])
      const ok = new Set(own.map((r) => r.id))
      linkIds = wanted.filter((id) => ok.has(id))
    }
    const rows = await rawQuery<{ id: string }>(
      `INSERT INTO shop_posts (user_id, kind, caption, images, reel_kind, reel_code, link_ids)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [userId, d.kind, caption, images, reelKind, reelCode, linkIds],
    )
    return NextResponse.json({ ok: true, id: rows[0].id })
  } catch (e) {
    console.error("[shop-posts] POST error:", e)
    return NextResponse.json({ error: "Could not save (is migration 19 run?)" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const userId = getSessionUserId(request)
  if (!userId) return unauthorized()
  const id = request.nextUrl.searchParams.get("id")
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  try {
    await rawQuery(`DELETE FROM shop_posts WHERE id = $1 AND user_id = $2`, [id, userId])
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[shop-posts] DELETE error:", e)
    return NextResponse.json({ error: "Delete failed" }, { status: 500 })
  }
}

import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { rawQuery } from "@/lib/supabase-server"
import { getSessionUserId } from "@/lib/auth"
import { cleanText } from "@/lib/shop/core"
import { MAX_VIDEOS_PER_USER, parseInstagramUrl, watchUrl } from "@/lib/shop/video"

const PostSchema = z.object({ url: z.string(), title: z.string().max(200).optional().nullable() })
const unauthorized = () => NextResponse.json({ error: "Not authenticated" }, { status: 401 })

export async function GET(request: NextRequest) {
  const userId = getSessionUserId(request)
  if (!userId) return unauthorized()
  try {
    const rows = await rawQuery<{ id: string; kind: string; shortcode: string; title: string | null }>(
      `SELECT id, kind, shortcode, title FROM shop_videos WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [userId, MAX_VIDEOS_PER_USER],
    )
    return NextResponse.json({ videos: rows.map((r) => ({ ...r, url: watchUrl(r.kind, r.shortcode) })) })
  } catch (e) {
    console.error("[shop-videos] GET error:", e)
    return NextResponse.json({ error: "Videos are not set up yet (run migration 18)." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const userId = getSessionUserId(request)
  if (!userId) return unauthorized()
  const parsed = PostSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Paste an Instagram reel or post link" }, { status: 400 })
  const ig = parseInstagramUrl(parsed.data.url)
  if (!ig.ok) return NextResponse.json({ error: ig.error }, { status: 400 })
  const title = cleanText(parsed.data.title, 80) || null
  try {
    const [{ n }] = await rawQuery<{ n: number }>(`SELECT COUNT(*)::int AS n FROM shop_videos WHERE user_id = $1`, [userId])
    if (n >= MAX_VIDEOS_PER_USER) return NextResponse.json({ error: `You can add up to ${MAX_VIDEOS_PER_USER} videos` }, { status: 400 })
    await rawQuery(
      `INSERT INTO shop_videos (user_id, kind, shortcode, title) VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id, shortcode) DO UPDATE SET title = EXCLUDED.title`,
      [userId, ig.media.kind, ig.media.shortcode, title],
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[shop-videos] POST error:", e)
    return NextResponse.json({ error: "Could not save (is migration 18 run?)" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const userId = getSessionUserId(request)
  if (!userId) return unauthorized()
  const id = request.nextUrl.searchParams.get("id")
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  try {
    await rawQuery(`DELETE FROM shop_videos WHERE id = $1 AND user_id = $2`, [id, userId])
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[shop-videos] DELETE error:", e)
    return NextResponse.json({ error: "Delete failed" }, { status: 500 })
  }
}

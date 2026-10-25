import { type NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth"
import { rawQuery } from "@/lib/supabase-server"
import { fetchProductImage, imageIsReachable } from "@/lib/links/image"

const recent = new Map<string, number[]>()
function limited(key: string) {
  const now = Date.now()
  const hits = (recent.get(key) || []).filter((t) => now - t < 60_000)
  if (hits.length >= 20) return true
  hits.push(now)
  recent.set(key, hits)
  return false
}

/**
 * GET /api/links/image?url=<product page or {link:slug}>
 * Finds the product's preview image. Returns { image: string | null } — null means "ask the user to upload one".
 */
export async function GET(request: NextRequest) {
  const userId = getSessionUserId(request)
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  if (limited(userId)) return NextResponse.json({ error: "Too many requests" }, { status: 429 })

  let target = (request.nextUrl.searchParams.get("url") || "").trim()
  if (!target) return NextResponse.json({ image: null })

  try {
    // A saved tracked link: use its stored image, or the page it points to.
    const m = /\{link:([a-z0-9]{4,12})\}/i.exec(target)
    if (m) {
      const rows = await rawQuery<{ url: string; image_url: string | null }>(
        `SELECT url, image_url FROM links WHERE user_id=$1 AND slug=$2`,
        [userId, m[1].toLowerCase()],
      )
      if (!rows[0]) return NextResponse.json({ image: null })
      if (rows[0].image_url && (await imageIsReachable(rows[0].image_url))) return NextResponse.json({ image: rows[0].image_url })
      target = rows[0].url
    }
    if (!/^https?:\/\//i.test(target)) target = `https://${target}`
    const found = await fetchProductImage(target)
    if (found && (await imageIsReachable(found))) return NextResponse.json({ image: found })
  } catch (e) {
    console.error("[links/image]", e)
  }
  return NextResponse.json({ image: null })
}

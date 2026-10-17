import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { rawQuery } from "@/lib/supabase-server"
import { getSessionUserId } from "@/lib/auth"
import { siteBase } from "@/lib/links/core"
import { hasAvatarColumn, hasBannerColumn } from "@/lib/shop/schema"
import { userMediaPrefix } from "@/lib/shop/media"
import { MAX_BIO, MAX_DISPLAY_NAME, cleanText, normalizeHandle, shopUrl } from "@/lib/shop/core"

const PutSchema = z.object({
  published: z.boolean(),
  display_name: z.string().max(200).optional().nullable(),
  bio: z.string().max(1000).optional().nullable(),
  avatar_url: z.string().max(1000).optional().nullable(), // "" removes it
  banner_url: z.string().max(1000).optional().nullable(),
})

const unauthorized = () => NextResponse.json({ error: "Not authenticated" }, { status: 401 })

/** The shop handle is always the owner's own Instagram username, so nobody can claim someone else's name. */
async function ownHandle(userId: string): Promise<{ ok: true; handle: string } | { ok: false; error: string }> {
  const rows = await rawQuery<{ username: string | null }>(`SELECT username FROM users WHERE id = $1 LIMIT 1`, [userId])
  const username = rows[0]?.username
  if (!username) return { ok: false, error: "We could not read your Instagram username" }
  const h = normalizeHandle(username)
  return h.ok ? h : { ok: false, error: "Your Instagram username cannot be used as a shop address" }
}

export async function GET(request: NextRequest) {
  const userId = getSessionUserId(request)
  if (!userId) return unauthorized()
  try {
    const own = await ownHandle(userId)
    const av = `${(await hasAvatarColumn()) ? "avatar_url" : "NULL::text AS avatar_url"}, ${(await hasBannerColumn()) ? "banner_url" : "NULL::text AS banner_url"}`
    const rows = await rawQuery(
      `SELECT handle, display_name, bio, ${av}, published FROM shop_profiles WHERE user_id = $1 LIMIT 1`,
      [userId],
    )
    const handle = own.ok ? own.handle : rows[0]?.handle ?? null
    return NextResponse.json({
      profile: rows[0] ?? null,
      handle,
      url: handle ? shopUrl(siteBase(), handle) : null,
      handleError: own.ok ? null : own.error,
    })
  } catch (e) {
    console.error("[shop] GET error:", e)
    return NextResponse.json({ error: "Shop pages are not set up yet (run migration 16)." }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const userId = getSessionUserId(request)
  if (!userId) return unauthorized()
  const parsed = PutSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  const displayName = cleanText(parsed.data.display_name, MAX_DISPLAY_NAME) || null
  const bio = cleanText(parsed.data.bio, MAX_BIO) || null

  try {
    const own = await ownHandle(userId)
    if (!own.ok) return NextResponse.json({ error: own.error }, { status: 400 })
    // Pictures: only ones this user uploaded through our own storage are accepted. "" removes.
    const prefix = userMediaPrefix(userId)
    const checkPic = (v: string | null | undefined): string | null | "bad" => {
      if (!v) return null
      return prefix && v.startsWith(prefix) && !v.includes("..") ? v : "bad"
    }
    const avatar = checkPic(parsed.data.avatar_url)
    const banner = checkPic(parsed.data.banner_url)
    if (avatar === "bad" || banner === "bad") return NextResponse.json({ error: "Pictures must be uploaded here" }, { status: 400 })
    const wantsAvatar = parsed.data.avatar_url !== undefined
    const wantsBanner = parsed.data.banner_url !== undefined
    if (wantsAvatar && !(await hasAvatarColumn())) return NextResponse.json({ error: "Profile pictures are not set up yet (run migration 22)." }, { status: 500 })
    if (wantsBanner && !(await hasBannerColumn())) return NextResponse.json({ error: "Banners are not set up yet (run migration 23)." }, { status: 500 })
    await rawQuery(
      `INSERT INTO shop_profiles (user_id, handle, display_name, bio, published, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (user_id) DO UPDATE
         SET handle = EXCLUDED.handle, display_name = EXCLUDED.display_name, bio = EXCLUDED.bio,
             published = EXCLUDED.published, updated_at = now()`,
      [userId, own.handle, displayName, bio, parsed.data.published],
    )
    if (wantsAvatar) await rawQuery(`UPDATE shop_profiles SET avatar_url = $2 WHERE user_id = $1`, [userId, avatar])
    if (wantsBanner) await rawQuery(`UPDATE shop_profiles SET banner_url = $2 WHERE user_id = $1`, [userId, banner])
    return NextResponse.json({ ok: true, handle: own.handle, url: shopUrl(siteBase(), own.handle) })
  } catch (e: any) {
    if (e?.code === "23505") {
      return NextResponse.json({ error: "That shop address is already used by another account" }, { status: 409 })
    }
    console.error("[shop] PUT error:", e)
    return NextResponse.json({ error: "Could not save (is migration 16 run?)" }, { status: 500 })
  }
}

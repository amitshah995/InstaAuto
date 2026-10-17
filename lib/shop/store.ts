import { rawQuery } from "@/lib/supabase-server"
import { normalizeHandle, type ShopLink } from "@/lib/shop/core"

export type ShopProfile = {
  user_id: string
  handle: string
  display_name: string | null
  bio: string | null
  published: boolean
}

export type ShopVideo = { kind: string; shortcode: string; title: string | null }
export type PublicShop = { profile: ShopProfile; links: ShopLink[]; videos: ShopVideo[] }

/**
 * Public read for /@handle. Returns null unless the shop is published, so an unpublished or
 * unknown handle looks exactly the same. Only enabled links the owner ticked are included.
 */
export async function getPublicShop(rawHandle: string): Promise<PublicShop | null> {
  const h = normalizeHandle(rawHandle)
  if (!h.ok) return null
  const profiles = await rawQuery<ShopProfile>(
    `SELECT user_id::text AS user_id, handle, display_name, bio, published
       FROM shop_profiles WHERE lower(handle) = $1 AND published = TRUE LIMIT 1`,
    [h.handle],
  )
  const profile = profiles[0]
  if (!profile) return null
  const links = await rawQuery<ShopLink>(
    `SELECT slug, title, network, disclose, image_url FROM links
      WHERE user_id = $1 AND disabled = FALSE AND shop_visible = TRUE
      ORDER BY created_at DESC LIMIT 100`,
    [profile.user_id],
  )
  let videos: ShopVideo[] = []
  try {
    videos = await rawQuery<ShopVideo>(
      `SELECT kind, shortcode, title FROM shop_videos WHERE user_id = $1 ORDER BY created_at DESC LIMIT 12`,
      [profile.user_id],
    )
  } catch {
    /* migration 18 not run yet: the page still works without videos */
  }
  return { profile, links, videos }
}

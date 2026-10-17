import { rawQuery } from "@/lib/supabase-server"
import { hasPosts } from "@/lib/shop/posts-store"
import { avatarSelect, priceSelect } from "@/lib/shop/schema"
import { normalizeHandle, type ShopLink } from "@/lib/shop/core"

export type ShopProfile = {
  user_id: string
  handle: string
  display_name: string | null
  bio: string | null
  avatar_url: string | null
  banner_url: string | null
  published: boolean
}

export type PublicShop = { profile: ShopProfile; links: ShopLink[]; hasStudio: boolean }

/**
 * Public read for /@handle. Returns null unless the shop is published, so an unpublished or
 * unknown handle looks exactly the same. Only enabled links the owner ticked are included.
 */
export async function getPublicShop(rawHandle: string): Promise<PublicShop | null> {
  const h = normalizeHandle(rawHandle)
  if (!h.ok) return null
  const av = await avatarSelect()
  const profiles = await rawQuery<ShopProfile>(
    `SELECT user_id::text AS user_id, handle, display_name, bio, ${av}, published
       FROM shop_profiles WHERE lower(handle) = $1 AND published = TRUE LIMIT 1`,
    [h.handle],
  )
  const profile = profiles[0]
  if (!profile) return null
  const pc = await priceSelect()
  const links = await rawQuery<ShopLink>(
    `SELECT slug, title, network, disclose, image_url, ${pc} FROM links
      WHERE user_id = $1 AND disabled = FALSE AND shop_visible = TRUE
      ORDER BY created_at DESC LIMIT 100`,
    [profile.user_id],
  )
  const hasStudio = await hasPosts(profile.user_id)
  return { profile, links, hasStudio }
}

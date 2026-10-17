import { rawQuery } from "@/lib/supabase-server"
import { fetchOwnMedia } from "@/lib/shop/ig-media"
import { normalizeHandle, type ShopLink } from "@/lib/shop/core"

export type PublicPost = {
  id: string
  kind: "images" | "reel"
  caption: string | null
  images: string[]
  reel_kind: string | null
  reel_code: string | null
  created_at: string
  products: ShopLink[]
  video_url: string | null // played inline from the owner's own reel, when available
  poster_url: string | null
}

type PostRow = Omit<PublicPost, "products" | "video_url" | "poster_url"> & { link_ids: string[]; ig_media_id: string | null }

async function attachProducts(userId: string, rows: PostRow[]): Promise<PublicPost[]> {
  const ids = [...new Set(rows.flatMap((r) => r.link_ids))]
  const byId = new Map<string, ShopLink>()
  if (ids.length) {
    const links = await rawQuery<ShopLink & { id: string }>(
      `SELECT id, slug, title, network, disclose, image_url FROM links
        WHERE user_id = $1 AND disabled = FALSE AND id = ANY($2::uuid[])`,
      [userId, ids],
    )
    for (const l of links) byId.set(l.id, l)
  }
  const media = await Promise.all(rows.map((r) => (r.kind === "reel" && r.ig_media_id ? fetchOwnMedia(userId, r.ig_media_id) : null)))
  return rows.map(({ link_ids, ig_media_id: _ig, ...p }, i) => ({
    ...p,
    products: link_ids.map((id) => byId.get(id)).filter((x): x is ShopLink => !!x),
    video_url: media[i]?.videoUrl ?? null,
    poster_url: media[i]?.posterUrl ?? null,
  }))
}

const COLS = `id::text AS id, kind, caption, images, reel_kind, reel_code, link_ids::text[] AS link_ids, ig_media_id, created_at`

/** Published posts of one owner, newest first. Never throws: the shop works without the posts table. */
export async function getPostsForUser(userId: string, limit = 20): Promise<PublicPost[]> {
  try {
    const rows = await rawQuery<PostRow>(
      `SELECT ${COLS} FROM shop_posts WHERE user_id = $1 AND published = TRUE AND (kind = 'images' OR ig_media_id IS NOT NULL) ORDER BY created_at DESC LIMIT $2`,
      [userId, limit],
    )
    return await attachProducts(userId, rows)
  } catch {
    return []
  }
}

/** One post, only when the owner's shop is published. */
export async function getPublicPost(rawHandle: string, id: string): Promise<{ handle: string; displayName: string | null; post: PublicPost } | null> {
  const h = normalizeHandle(rawHandle)
  if (!h.ok || !/^[0-9a-f-]{36}$/i.test(id)) return null
  const prof = await rawQuery<{ user_id: string; handle: string; display_name: string | null }>(
    `SELECT user_id::text AS user_id, handle, display_name FROM shop_profiles WHERE lower(handle) = $1 AND published = TRUE LIMIT 1`,
    [h.handle],
  )
  if (!prof[0]) return null
  const rows = await rawQuery<PostRow>(
    `SELECT ${COLS} FROM shop_posts WHERE id = $1 AND user_id = $2 AND published = TRUE AND (kind = 'images' OR ig_media_id IS NOT NULL) LIMIT 1`,
    [id, prof[0].user_id],
  )
  if (!rows[0]) return null
  const [post] = await attachProducts(prof[0].user_id, rows)
  return { handle: prof[0].handle, displayName: prof[0].display_name, post }
}

/** Cheap check used by the shop page to decide whether to show the Studio tab. */
export async function hasPosts(userId: string): Promise<boolean> {
  try {
    const r = await rawQuery(`SELECT 1 FROM shop_posts WHERE user_id = $1 AND published = TRUE LIMIT 1`, [userId])
    return r.length > 0
  } catch {
    return false
  }
}

/** Studio feed page: the owner's public profile plus their posts, only when the shop is published. */
export async function getPublicStudio(rawHandle: string): Promise<{ handle: string; displayName: string | null; bio: string | null; posts: PublicPost[] } | null> {
  const h = normalizeHandle(rawHandle)
  if (!h.ok) return null
  const prof = await rawQuery<{ user_id: string; handle: string; display_name: string | null; bio: string | null }>(
    `SELECT user_id::text AS user_id, handle, display_name, bio FROM shop_profiles WHERE lower(handle) = $1 AND published = TRUE LIMIT 1`,
    [h.handle],
  )
  if (!prof[0]) return null
  const posts = await getPostsForUser(prof[0].user_id, 30)
  return { handle: prof[0].handle, displayName: prof[0].display_name, bio: prof[0].bio, posts }
}

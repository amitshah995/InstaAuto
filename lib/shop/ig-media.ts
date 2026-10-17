import { rawQuery } from "@/lib/supabase-server"
import { decryptToken } from "@/lib/token-crypto"

export type IgMedia = {
  mediaType: string
  videoUrl: string | null
  posterUrl: string | null
  permalink: string | null
}

const OK_TTL = 20 * 60_000 // media_url links expire after a while, so keep them only briefly
const FAIL_TTL = 2 * 60_000
const cache = new Map<string, { at: number; ttl: number; value: IgMedia | null }>()

/** Only Instagram / Facebook CDN hosts may ever be put into a <video> or <img> on the shop pages. */
export function isInstagramCdnUrl(raw: unknown): raw is string {
  if (typeof raw !== "string") return false
  try {
    const u = new URL(raw)
    const h = u.hostname.toLowerCase()
    return u.protocol === "https:" && (h.endsWith(".cdninstagram.com") || h.endsWith(".fbcdn.net"))
  } catch {
    return false
  }
}

async function tokenFor(userId: string): Promise<string | null> {
  const rows = await rawQuery<{ access_token: string | null }>(`SELECT access_token FROM users WHERE id = $1 LIMIT 1`, [userId])
  const raw = rows[0]?.access_token
  if (!raw || raw === "REVOKED") return null
  try {
    return decryptToken(raw)
  } catch {
    return null
  }
}

/**
 * Reads one of the OWNER'S OWN media items through their own Instagram token (server side only).
 * Returns null when the token is gone, the id is not theirs, or Instagram refuses. Never throws.
 */
export async function fetchOwnMedia(userId: string, mediaId: string): Promise<IgMedia | null> {
  if (!/^\d{5,25}$/.test(mediaId)) return null
  const key = `${userId}:${mediaId}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < hit.ttl) return hit.value
  let value: IgMedia | null = null
  try {
    const token = await tokenFor(userId)
    if (token) {
      const res = await fetch(
        `https://graph.instagram.com/${mediaId}?fields=media_type,media_url,thumbnail_url,permalink&access_token=${encodeURIComponent(token)}`,
        { cache: "no-store", signal: AbortSignal.timeout(6000) },
      )
      const j = await res.json().catch(() => null)
      if (res.ok && j && !j.error) {
        value = {
          mediaType: String(j.media_type || ""),
          videoUrl: j.media_type === "VIDEO" && isInstagramCdnUrl(j.media_url) ? j.media_url : null,
          posterUrl: isInstagramCdnUrl(j.thumbnail_url) ? j.thumbnail_url : null,
          permalink: typeof j.permalink === "string" ? j.permalink : null,
        }
      }
    }
  } catch {
    /* network problems just mean the fallback is shown */
  }
  cache.set(key, { at: Date.now(), ttl: value ? OK_TTL : FAIL_TTL, value })
  if (cache.size > 500) cache.delete(cache.keys().next().value as string)
  return value
}

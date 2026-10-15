import { getSupabaseServerClient } from "@/lib/supabase-server"
import type { MediaKind, MediaSample, ProfileSnapshot } from "./types"

/**
 * THE ONLY FILE THAT KNOWS HOW PROFILE DATA IS FETCHED.
 *
 * Source: the signed-in user's OWN account, read with their own Instagram-Login token
 * (graph.instagram.com /me and /me/media). This works with the permissions the app already has
 * (instagram_business_basic). Business Discovery (looking up other people's accounts) is not
 * available with an Instagram-Login token: Instagram answers
 * "Tried accessing nonexisting field (business_discovery)". Verified on the live app.
 *
 * Works for Business and Creator accounts (the only types Instagram Login supports).
 */

export type LookupErrorCode = "reconnect_required" | "rate_limited" | "provider_unavailable"

export class LookupError extends Error {
  constructor(public code: LookupErrorCode, message: string) {
    super(message)
  }
}

export interface LookupProvider {
  /** Profile snapshot for the signed-in user's own account. */
  fetchOwnProfile(userId: string): Promise<ProfileSnapshot>
}

const GRAPH = "https://graph.instagram.com/v24.0"
const PROFILE_FIELDS = "username,name,biography,website,profile_picture_url,followers_count,follows_count,media_count"
const MEDIA_FIELDS = "caption,comments_count,like_count,media_type,media_product_type,timestamp,permalink,thumbnail_url,media_url"

function kindOf(mediaType: string | undefined, productType: string | undefined): MediaKind {
  if (productType === "REELS") return "reel"
  switch (mediaType) {
    case "CAROUSEL_ALBUM": return "carousel"
    case "IMAGE": return "image"
    case "VIDEO": return "video" // a feed video that is not a Reel
    default: return "other"
  }
}

/** Maps the raw /me and /me/media responses into the source-agnostic snapshot. */
export function mapOwnProfile(me: any, mediaItems: any[], fetchedAt = new Date()): ProfileSnapshot {
  const media: MediaSample[] = (Array.isArray(mediaItems) ? mediaItems : [])
    // Stories are not returned by /me/media, but ads can be; skip anything without a timestamp.
    .filter((m) => m && typeof m.timestamp === "string")
    .map((m) => ({
      kind: kindOf(m.media_type, m.media_product_type),
      timestamp: m.timestamp,
      caption: typeof m.caption === "string" ? m.caption : "",
      likeCount: typeof m.like_count === "number" ? m.like_count : undefined,
      commentCount: typeof m.comments_count === "number" ? m.comments_count : 0,
      permalink: typeof m.permalink === "string" ? m.permalink : undefined,
      thumbnailUrl: typeof m.thumbnail_url === "string" ? m.thumbnail_url : typeof m.media_url === "string" && m.media_type !== "VIDEO" ? m.media_url : undefined,
    }))
  media.sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp))

  return {
    username: String(me?.username ?? ""),
    name: me?.name || undefined,
    biography: me?.biography || undefined,
    website: me?.website || undefined,
    hasProfilePicture: !!me?.profile_picture_url,
    profilePictureUrl: typeof me?.profile_picture_url === "string" ? me.profile_picture_url : undefined,
    followersCount: Number(me?.followers_count ?? 0),
    followsCount: me?.follows_count === undefined ? undefined : Number(me.follows_count),
    mediaCount: Number(me?.media_count ?? 0),
    media,
    fetchedAt: fetchedAt.toISOString(),
  }
}

export function mapGraphError(err: any): LookupError {
  const code = Number(err?.code)
  const msg = String(err?.message ?? "")
  if ([4, 17, 32, 613].includes(code)) {
    return new LookupError("rate_limited", "Instagram rate limit reached")
  }
  if (code === 190 || code === 102) {
    return new LookupError("reconnect_required", "Token is invalid or expired")
  }
  // The detail goes to server logs only (the route shows users a generic message). No token is included.
  return new LookupError("provider_unavailable", `Instagram lookup failed (graph code ${code || "?"}: ${msg.slice(0, 200) || "no message"})`)
}

async function graphGet(path: string, params: Record<string, string>, token: string): Promise<any> {
  const qs = new URLSearchParams({ ...params, access_token: token })
  let res: Response
  try {
    res = await fetch(`${GRAPH}${path}?${qs.toString()}`, { cache: "no-store" })
  } catch {
    throw new LookupError("provider_unavailable", "Instagram lookup failed (network)")
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok || body?.error) throw mapGraphError(body?.error)
  return body
}

class InstagramOwnProvider implements LookupProvider {
  async fetchOwnProfile(userId: string): Promise<ProfileSnapshot> {
    const db = await getSupabaseServerClient()
    const { data } = await db.from("users").select("access_token").eq("id", userId).single()
    const token = data?.access_token
    if (!token || token === "REVOKED") {
      throw new LookupError("reconnect_required", "No valid token for this user")
    }
    const me = await graphGet("/me", { fields: PROFILE_FIELDS }, token)
    let media: any
    try {
      media = await graphGet("/me/media", { fields: MEDIA_FIELDS, limit: "30" }, token)
    } catch (e) {
      // If a field is rejected (code 100) retry with the minimal set rather than failing the audit.
      if (e instanceof LookupError && e.code === "provider_unavailable" && /graph code 100/.test(e.message)) {
        media = await graphGet("/me/media", { fields: "caption,comments_count,like_count,media_type,timestamp", limit: "30" }, token)
      } else {
        throw e
      }
    }
    return mapOwnProfile(me, media?.data ?? [])
  }
}

/** Deterministic fake data for tests and local demos. Never active in production. */
class FixtureProvider implements LookupProvider {
  async fetchOwnProfile(userId: string): Promise<ProfileSnapshot> {
    if (userId.endsWith("0")) throw new LookupError("reconnect_required", "Token is invalid or expired")
    if (userId.endsWith("9")) throw new LookupError("rate_limited", "Instagram rate limit reached")
    if (userId.endsWith("8")) throw new LookupError("provider_unavailable", "Instagram lookup failed (fixture)")
    const strong = userId.endsWith("1")
    const now = Date.now()
    const media: MediaSample[] = Array.from({ length: strong ? 20 : 4 }, (_, i) => ({
      kind: strong ? (["reel", "carousel", "image", "reel"][i % 4] as MediaKind) : "image",
      timestamp: new Date(now - i * (strong ? 1.5 : 20) * 86_400_000).toISOString(),
      caption: strong
        ? "Here is how we grew 3x this year. Comment LINK and we will DM you the guide! #growth #marketing #business #tips"
        : "nice",
      likeCount: strong ? 900 : 5,
      commentCount: strong ? 60 : 0,
    }))
    return {
      username: strong ? "strong_co" : "weak_co",
      name: strong ? "Strong Co" : undefined,
      biography: strong ? "We help small businesses grow on Instagram. DM 'START' to begin." : undefined,
      website: strong ? "https://example.com" : undefined,
      hasProfilePicture: true,
      followersCount: strong ? 20_000 : 800,
      mediaCount: media.length,
      media,
      fetchedAt: new Date().toISOString(),
    }
  }
}

export function getProvider(): LookupProvider {
  if (process.env.NODE_ENV !== "production" && process.env.AUDIT_PROVIDER === "fixture") {
    return new FixtureProvider()
  }
  return new InstagramOwnProvider()
}

import { getSupabaseServerClient } from "@/lib/supabase-server"
import type { MediaKind, MediaSample, ProfileSnapshot } from "./types"

/**
 * THE ONLY FILE THAT KNOWS HOW PUBLIC PROFILE DATA IS FETCHED.
 *
 * Current implementation: Instagram "Business Discovery" using the access token of one
 * connected account (AUDIT_LOOKUP_USER_ID).
 *
 * UNVERIFIED: Business Discovery is documented under Facebook Login. Whether it works with an
 * Instagram-Login token is exactly what scripts/spike-business-discovery.mjs checks. If it does
 * not, only this file changes (swap the provider); scoring, API, pages and DB stay as they are.
 *
 * Limits of this source: Business/Creator accounts only; private, personal and age-gated
 * accounts are not returned.
 */

export type LookupErrorCode =
  | "invalid_username"
  | "not_found_or_not_professional"
  | "rate_limited"
  | "provider_unavailable"

export class LookupError extends Error {
  constructor(public code: LookupErrorCode, message: string) {
    super(message)
  }
}

const USERNAME_RE = /^[a-z0-9._]{1,30}$/

export function normalizeUsername(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const u = raw.trim().replace(/^@/, "").toLowerCase()
  return USERNAME_RE.test(u) ? u : null
}

export interface LookupProvider {
  fetchProfile(username: string): Promise<ProfileSnapshot>
}

const GRAPH = "https://graph.instagram.com/v24.0"
const PROFILE_FIELDS = "username,name,biography,website,profile_picture_url,followers_count,follows_count,media_count"
const MEDIA_FIELDS = "caption,comments_count,like_count,media_type,timestamp"

function kindOf(mediaType: string | undefined): MediaKind {
  switch (mediaType) {
    case "CAROUSEL_ALBUM": return "carousel"
    case "IMAGE": return "image"
    // Videos shared on Instagram are Reels; the product-type field is not requested because an
    // unsupported field would fail the whole call.
    case "VIDEO": return "reel"
    default: return "other"
  }
}

export function mapBusinessDiscovery(bd: any, fetchedAt = new Date()): ProfileSnapshot {
  const media: MediaSample[] = (bd?.media?.data ?? []).map((m: any) => ({
    kind: kindOf(m.media_type),
    timestamp: m.timestamp,
    caption: typeof m.caption === "string" ? m.caption : "",
    likeCount: typeof m.like_count === "number" ? m.like_count : undefined,
    commentCount: typeof m.comments_count === "number" ? m.comments_count : 0,
  }))
  media.sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp))

  return {
    username: String(bd.username),
    name: bd.name || undefined,
    biography: bd.biography || undefined,
    website: bd.website || undefined,
    hasProfilePicture: !!bd.profile_picture_url,
    followersCount: Number(bd.followers_count ?? 0),
    followsCount: bd.follows_count === undefined ? undefined : Number(bd.follows_count),
    mediaCount: Number(bd.media_count ?? 0),
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
    return new LookupError("provider_unavailable", "Lookup account token is invalid or expired")
  }
  // Wording for "not a professional account / no such user" is unconfirmed until Spike 0.
  if (/invalid user id|cannot be found|does not exist|not a business|no such user|unsupported get request/i.test(msg) || code === 110) {
    return new LookupError("not_found_or_not_professional", "Account not found or not a Business/Creator account")
  }
  return new LookupError("provider_unavailable", "Instagram lookup failed")
}

class BusinessDiscoveryProvider implements LookupProvider {
  private async token(): Promise<string> {
    const id = process.env.AUDIT_LOOKUP_USER_ID
    if (!id) throw new LookupError("provider_unavailable", "AUDIT_LOOKUP_USER_ID is not configured")
    const db = await getSupabaseServerClient()
    const { data } = await db.from("users").select("access_token").eq("id", id).single()
    if (!data?.access_token || data.access_token === "REVOKED") {
      throw new LookupError("provider_unavailable", "Lookup account has no valid token")
    }
    return data.access_token
  }

  async fetchProfile(username: string): Promise<ProfileSnapshot> {
    if (!normalizeUsername(username)) throw new LookupError("invalid_username", "Invalid username")
    const token = await this.token()
    // username is validated against USERNAME_RE above, so it is safe to interpolate.
    const fields = `business_discovery.username(${username}){${PROFILE_FIELDS},media.limit(30){${MEDIA_FIELDS}}}`
    let res: Response
    try {
      res = await fetch(`${GRAPH}/me?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token)}`)
    } catch {
      throw new LookupError("provider_unavailable", "Instagram lookup failed")
    }
    const body = await res.json().catch(() => ({}))
    if (!res.ok || body?.error) throw mapGraphError(body?.error)
    if (!body?.business_discovery) throw new LookupError("not_found_or_not_professional", "Account not found")
    return mapBusinessDiscovery(body.business_discovery)
  }
}

/** Deterministic fake data for tests and local demos. Never active in production. */
class FixtureProvider implements LookupProvider {
  async fetchProfile(username: string): Promise<ProfileSnapshot> {
    if (username.startsWith("missing")) {
      throw new LookupError("not_found_or_not_professional", "Account not found or not a Business/Creator account")
    }
    if (username.startsWith("ratelimited")) throw new LookupError("rate_limited", "Instagram rate limit reached")
    const strong = username.startsWith("strong")
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
      username,
      name: username,
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
  return new BusinessDiscoveryProvider()
}

// ---------- cache (24h) so repeat lookups never hit the shared token ----------

const CACHE_TTL_MS = 24 * 60 * 60 * 1000

export async function getCachedProfile(username: string, now = Date.now()): Promise<ProfileSnapshot | null> {
  const db = await getSupabaseServerClient()
  const { data } = await db.from("ig_lookup_cache").select("payload, fetched_at").eq("ig_username", username).single()
  if (!data) return null
  if (now - new Date(data.fetched_at).getTime() > CACHE_TTL_MS) return null
  return (typeof data.payload === "string" ? JSON.parse(data.payload) : data.payload) as ProfileSnapshot
}

export async function putCachedProfile(profile: ProfileSnapshot): Promise<void> {
  const db = await getSupabaseServerClient()
  await db
    .from("ig_lookup_cache")
    .upsert(
      { ig_username: profile.username.toLowerCase(), payload: profile, fetched_at: new Date().toISOString() },
      { onConflict: "ig_username" }
    )
}

/** Number of live (uncached) provider calls in the last hour; protects the shared token. */
export async function liveLookupsLastHour(): Promise<number> {
  const db = await getSupabaseServerClient()
  const since = new Date(Date.now() - 3_600_000).toISOString()
  const { data } = await db.from("ig_lookup_cache").select("ig_username").gte("fetched_at", since)
  return Array.isArray(data) ? data.length : 0
}

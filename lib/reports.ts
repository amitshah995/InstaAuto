import crypto from "crypto"
import { rawQuery } from "@/lib/supabase-server"
import { decryptToken } from "@/lib/token-crypto"

export interface FollowerPoint {
  day: string
  followers: number
}

/** Fetch followers_count from Instagram and store today's snapshot. Returns the count or null. */
export async function recordFollowerSnapshot(userId: number | string, encryptedToken: string): Promise<number | null> {
  try {
    const token = decryptToken(encryptedToken)
    const res = await fetch(
      `https://graph.instagram.com/v24.0/me?fields=followers_count,media_count&access_token=${encodeURIComponent(token)}`,
    )
    const data = await res.json()
    if (typeof data?.followers_count !== "number") return null
    await rawQuery(
      `INSERT INTO follower_snapshots (user_id, day, followers, media_count)
       VALUES ($1, CURRENT_DATE, $2, $3)
       ON CONFLICT (user_id, day) DO UPDATE SET followers = EXCLUDED.followers, media_count = EXCLUDED.media_count`,
      [userId, data.followers_count, data.media_count ?? null],
    )
    return data.followers_count
  } catch (e) {
    console.error("[reports] snapshot failed:", e)
    return null
  }
}

export async function getFollowerSeries(userId: number | string, days = 30): Promise<FollowerPoint[]> {
  try {
    const rows = await rawQuery<{ day: string; followers: number }>(
      `SELECT to_char(day, 'YYYY-MM-DD') AS day, followers
         FROM follower_snapshots WHERE user_id = $1 AND day >= CURRENT_DATE - $2::int
        ORDER BY day`,
      [userId, days],
    )
    return rows
  } catch {
    return [] // migration 24 not run yet
  }
}

export interface ReportStats {
  days: number
  commentsMatched: number
  dmsSent: number
  dmsFailed: number
  linkClicks: number
  contacts: number
}

/** Aggregate numbers for the last N days. Every query is tolerant of missing tables. */
export async function getReportStats(userId: number | string, days = 30): Promise<ReportStats> {
  const safe = async (sql: string): Promise<number> => {
    try {
      const r = await rawQuery<{ n: number }>(sql, [userId, days])
      return Number(r[0]?.n || 0)
    } catch {
      return 0
    }
  }
  const [commentsMatched, dmsSent, dmsFailed, linkClicks, contacts] = await Promise.all([
    safe(`SELECT COUNT(*)::int n FROM automation_runs WHERE user_id=$1 AND event_type='comment' AND matched AND created_at > now() - $2::int * interval '1 day'`),
    safe(`SELECT COUNT(*)::int n FROM automation_runs WHERE user_id=$1 AND action_status='sent' AND created_at > now() - $2::int * interval '1 day'`),
    safe(`SELECT COUNT(*)::int n FROM automation_runs WHERE user_id=$1 AND action_status='failed' AND created_at > now() - $2::int * interval '1 day'`),
    safe(`SELECT COUNT(c.id)::int n FROM link_clicks c JOIN links l ON l.id=c.link_id WHERE l.user_id=$1 AND c.is_bot=FALSE AND c.clicked_at > now() - $2::int * interval '1 day'`),
    safe(`SELECT COUNT(*)::int n FROM contacts WHERE user_id=$1 AND created_at > now() - $2::int * interval '1 day'`),
  ])
  return { days, commentsMatched, dmsSent, dmsFailed, linkClicks, contacts }
}

export function makeReportSlug(): string {
  return crypto.randomBytes(9).toString("base64url")
}

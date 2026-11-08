/**
 * Per-post funnel: for each automation (usually one per post) how many comments matched, how many DMs were
 * sent or failed, and how many people clicked its tracked links.
 *
 * Why: the marketing plan says to watch "keyword comments per post, then DM sent, then link clicks", and to use a
 * different word per post so the owner can see which post brought people. This is that view.
 *
 * Honest limits (also shown in the UI):
 *  - "Comments matched" counts comments that triggered a rule, not all comments on the post.
 *  - Link clicks are summed per tracked link used in the automation's message. If the same tracked link is used
 *    in two automations, its clicks show under both.
 *  - It only has data from the day automation logging started.
 * Every query tolerates a missing table (returns what it can).
 */
import { rawQuery } from "@/lib/supabase-server"

export interface FunnelRow {
  automationId: string
  name: string
  source: string
  mediaId: string | null
  caption: string | null
  keywords: string
  active: boolean
  matched: number
  sent: number
  failed: number
  clicks: number
  /** sent / matched as a whole percent, null when nothing matched */
  sendRate: number | null
  /** link clicks per 100 DMs sent (can exceed 100: one person may click twice), null when nothing was sent or no tracked link is used */
  clickRate: number | null
  hasTrackedLink: boolean
}

const TOKEN_RE = /\{link:([a-z0-9]{4,12})\}/gi

/** Finds the tracked-link slugs used in a stored message (JSON text). Exported for tests. */
export function slugsIn(text: string): string[] {
  const out = new Set<string>()
  for (const m of text.matchAll(TOKEN_RE)) out.add(m[1].toLowerCase())
  return [...out]
}

export async function getFunnel(userId: number | string, days = 30): Promise<{ rows: FunnelRow[]; days: number }> {
  let autos: any[] = []
  try {
    autos = await rawQuery(
      `SELECT a.id::text AS id, a.name, a.trigger_source, a.trigger_value, a.is_active, a.specific_media_id,
              a.response_content::text AS rc,
              (SELECT m.caption FROM media_cache m WHERE m.user_id = a.user_id AND m.media_id = a.specific_media_id LIMIT 1) AS caption
         FROM automations a WHERE a.user_id = $1 ORDER BY a.created_at DESC LIMIT 100`,
      [userId],
    )
  } catch {
    // media_cache can be missing columns on old databases: retry without the caption.
    try {
      autos = await rawQuery(
        `SELECT a.id::text AS id, a.name, a.trigger_source, a.trigger_value, a.is_active, a.specific_media_id,
                a.response_content::text AS rc, NULL::text AS caption
           FROM automations a WHERE a.user_id = $1 ORDER BY a.created_at DESC LIMIT 100`,
        [userId],
      )
    } catch {
      return { rows: [], days }
    }
  }

  const runs = new Map<string, { matched: number; sent: number; failed: number }>()
  try {
    const r = await rawQuery<{ id: string; matched: number; sent: number; failed: number }>(
      `SELECT automation_id::text AS id,
              COUNT(*) FILTER (WHERE matched)::int AS matched,
              COUNT(*) FILTER (WHERE action_status = 'sent')::int AS sent,
              COUNT(*) FILTER (WHERE action_status = 'failed')::int AS failed
         FROM automation_runs
        WHERE user_id = $1 AND automation_id IS NOT NULL AND created_at > now() - $2::int * interval '1 day'
        GROUP BY automation_id`,
      [userId, days],
    )
    for (const x of r) runs.set(x.id, x)
  } catch {}

  const clicksBySlug = new Map<string, number>()
  try {
    const c = await rawQuery<{ slug: string; n: number }>(
      `SELECT lower(l.slug) AS slug, COUNT(c.id)::int AS n
         FROM links l JOIN link_clicks c ON c.link_id = l.id
        WHERE l.user_id = $1 AND c.is_bot = FALSE AND c.clicked_at > now() - $2::int * interval '1 day'
        GROUP BY lower(l.slug)`,
      [userId, days],
    )
    for (const x of c) clicksBySlug.set(x.slug, x.n)
  } catch {}

  const rows: FunnelRow[] = autos.map((a) => {
    const r = runs.get(a.id) || { matched: 0, sent: 0, failed: 0 }
    const slugs = slugsIn(String(a.rc || ""))
    const clicks = slugs.reduce((n, s) => n + (clicksBySlug.get(s) || 0), 0)
    return {
      automationId: a.id,
      name: a.name,
      source: a.trigger_source,
      mediaId: a.specific_media_id || null,
      caption: a.caption ? String(a.caption).slice(0, 90) : null,
      keywords: String(a.trigger_value || ""),
      active: !!a.is_active,
      matched: r.matched,
      sent: r.sent,
      failed: r.failed,
      clicks,
      sendRate: r.matched > 0 ? Math.round((r.sent / r.matched) * 100) : null,
      clickRate: slugs.length > 0 && r.sent > 0 ? Math.round((clicks / r.sent) * 100) : null,
      hasTrackedLink: slugs.length > 0,
    }
  })
  // Most active first so the posts that matter are at the top.
  rows.sort((x, y) => y.matched - x.matched || y.sent - x.sent)
  return { rows, days }
}

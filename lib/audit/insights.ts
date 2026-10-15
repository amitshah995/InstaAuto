import type { AuditInsights, MediaKind, PostPoint, ProfileSnapshot, ReportProfile, SignalState } from "./types"

/**
 * Pure helpers that turn the posts we already read into the report panels.
 * Everything here comes from the account's own /me and /me/media data. Nothing is estimated from
 * outside sources, and nothing forecasts the future (we do not have follower history).
 *
 * The "working target" per audience size is a HEURISTIC (same table used for scoring), not an
 * official or industry-certified benchmark. The page says so.
 */

export const TIERS = [
  { maxFollowers: 10_000, label: "Starter", range: "under 10K" },
  { maxFollowers: 100_000, label: "Mid-tier", range: "10K-100K" },
  { maxFollowers: 1_000_000, label: "Large", range: "100K-1M" },
  { maxFollowers: Infinity, label: "Mega", range: "1M+" },
]

const BIO_CTA_RE = /\b(dm|book|order|shop|buy|call|contact|whatsapp|email|link|apply|join|start|get)\b/i
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const r1 = (n: number) => Math.round(n * 10) / 10
const r2 = (n: number) => Math.round(n * 100) / 100

export function toPostPoints(p: ProfileSnapshot): PostPoint[] {
  return p.media.map((m) => ({
    kind: m.kind,
    timestamp: m.timestamp,
    likes: typeof m.likeCount === "number" ? m.likeCount : null,
    comments: m.commentCount,
    caption: m.caption.slice(0, 160),
    thumb: m.thumbnailUrl,
    permalink: m.permalink,
  }))
}

export function toReportProfile(p: ProfileSnapshot): ReportProfile {
  return {
    name: p.name,
    bio: p.biography,
    website: p.website,
    pictureUrl: p.profilePictureUrl,
    followers: p.followersCount,
    following: p.followsCount,
    posts: p.mediaCount,
  }
}

const interactions = (m: { likes: number | null; comments: number }) => (m.likes ?? 0) + m.comments

export function computeInsights(p: ProfileSnapshot, targetPct: number): AuditInsights {
  const posts = toPostPoints(p)
  const tier = TIERS.find((t) => p.followersCount <= t.maxFollowers)!
  const n = posts.length
  const likesHidden = n > 0 && posts.every((m) => m.likes === null)

  const totalLikes = posts.reduce((a, m) => a + (m.likes ?? 0), 0)
  const totalComments = posts.reduce((a, m) => a + m.comments, 0)
  const avgLikes = n ? Math.round(totalLikes / n) : 0
  const avgComments = n ? r1(totalComments / n) : 0
  const avgInter = mean(posts.map(interactions))
  const erPct = n && p.followersCount > 0 ? r2((avgInter / p.followersCount) * 100) : null

  // ---- cadence
  const times = posts.map((m) => new Date(m.timestamp).getTime()).sort((a, b) => b - a)
  let perWeek = 0
  let avgGapDays: number | null = null
  let consistency: number | null = null
  if (times.length >= 2) {
    const spanDays = Math.max(1, (times[0] - times[times.length - 1]) / 86_400_000)
    perWeek = r1(((times.length - 1) / spanDays) * 7)
    const gaps = times.slice(0, -1).map((t, i) => (t - times[i + 1]) / 86_400_000)
    const g = mean(gaps)
    avgGapDays = r1(g)
    if (gaps.length >= 3 && g > 0) {
      const sd = Math.sqrt(mean(gaps.map((x) => (x - g) ** 2)))
      consistency = Math.round(Math.min(1, Math.max(0, 1 - sd / g / 2)) * 100)
    }
  }

  // ---- hashtags
  const tagCounts = new Map<string, number>()
  for (const m of posts) {
    const seen = new Set((m.caption.match(/#[\p{L}\p{N}_]+/gu) || []).map((t) => t.toLowerCase()))
    seen.forEach((t) => tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1))
  }
  const hashtags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([tag, count]) => ({ tag, count }))

  // ---- formats
  const byKind = new Map<MediaKind, number[]>()
  for (const m of posts) byKind.set(m.kind, [...(byKind.get(m.kind) ?? []), interactions(m)])
  const formats = [...byKind.entries()]
    .map(([kind, xs]) => ({ kind, count: xs.length, avgInteractions: Math.round(mean(xs)) }))
    .sort((a, b) => b.count - a.count)

  // ---- top post
  let top: AuditInsights["top"] = null
  if (n) {
    let bi = 0
    posts.forEach((m, i) => { if (interactions(m) > interactions(posts[bi])) bi = i })
    top = {
      index: bi,
      multipleOfAvg: avgInter > 0 ? r1(interactions(posts[bi]) / avgInter) : 0,
      erPct: p.followersCount > 0 ? r2((interactions(posts[bi]) / p.followersCount) * 100) : null,
    }
  }

  // ---- signals
  const bio = (p.biography ?? "").trim()
  const signals: AuditInsights["signals"] = []
  const sig = (id: string, title: string, detail: string, state: SignalState) => signals.push({ id, title, detail, state })
  if (!bio) sig("bio", "Bio optimization", "Your bio is empty.", "bad")
  else if (bio.length < 40) sig("bio", "Bio optimization", `Short bio (${bio.length} characters). Use up to 150.`, "warn")
  else if (!BIO_CTA_RE.test(bio)) sig("bio", "Bio optimization", `Good length (${bio.length} characters) but no call to action.`, "warn")
  else sig("bio", "Bio optimization", `Optimized bio (${bio.length} characters).`, "good")

  const kinds = byKind.size
  if (!n) sig("formats", "Media format diversity", "No posts to analyze yet.", "warn")
  else if (kinds >= 3) sig("formats", "Media format diversity", `Healthy diversity across ${kinds} content formats.`, "good")
  else if (kinds === 2) sig("formats", "Media format diversity", "Two formats in use. Try adding one more.", "good")
  else sig("formats", "Media format diversity", "Only one content format. Mix Reels, carousels and images.", "warn")

  if (times.length < 2) sig("cadence", "Posting cadence", "Not enough posts to measure cadence.", "warn")
  else if (perWeek >= 3) sig("cadence", "Posting cadence", `Active rhythm (~${perWeek} uploads/week).`, "good")
  else if (perWeek >= 1) sig("cadence", "Posting cadence", `Steady (~${perWeek} uploads/week). 3+ keeps you visible.`, "warn")
  else sig("cadence", "Posting cadence", `Slow (~${perWeek} uploads/week).`, "bad")

  return {
    tier: { label: tier.label, range: tier.range },
    erPct,
    targetPct,
    deltaPct: erPct === null ? null : r2(erPct - targetPct),
    likesHidden,
    postsUsed: n,
    totalLikes,
    totalComments,
    avgLikes,
    avgComments,
    likeCommentRatio: totalComments > 0 ? r1(totalLikes / totalComments) : null,
    followerFollowingRatio: p.followsCount && p.followsCount > 0 ? r1(p.followersCount / p.followsCount) : null,
    signals,
    cadence: { perWeek, avgGapDays, consistency },
    hashtags,
    avgCaptionLength: Math.round(mean(posts.map((m) => m.caption.length))),
    formats,
    top,
  }
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
export const DAY_SHORT = [...DAYS.slice(1), DAYS[0]] // Mon..Sun for charts

/**
 * Day-of-week and hour breakdown in the viewer's own time zone (offsetMin = minutes ahead of UTC,
 * e.g. 330 for India). Computed in the browser so "4 PM" means 4 PM for the person reading it.
 */
export function timeBreakdown(posts: PostPoint[], offsetMin: number) {
  const dayTotals = Array.from({ length: 7 }, () => ({ sum: 0, n: 0 })) // index 0 = Monday
  const hourTotals = Array.from({ length: 24 }, () => ({ sum: 0, n: 0 }))
  for (const m of posts) {
    const d = new Date(new Date(m.timestamp).getTime() + offsetMin * 60_000)
    const day = (d.getUTCDay() + 6) % 7
    const hour = d.getUTCHours()
    const v = interactions(m)
    dayTotals[day].sum += v; dayTotals[day].n++
    hourTotals[hour].sum += v; hourTotals[hour].n++
  }
  const dayAvg = dayTotals.map((t) => (t.n ? Math.round(t.sum / t.n) : 0))
  let bestDay = -1, bestHour = -1
  dayTotals.forEach((t, i) => { if (t.n && (bestDay < 0 || t.sum / t.n > dayTotals[bestDay].sum / dayTotals[bestDay].n)) bestDay = i })
  hourTotals.forEach((t, i) => { if (t.n && (bestHour < 0 || t.sum / t.n > hourTotals[bestHour].sum / hourTotals[bestHour].n)) bestHour = i })
  return {
    dayAvg,
    peakDay: bestDay < 0 ? null : DAY_NAMES[(bestDay + 1) % 7],
    peakHour: bestHour < 0 ? null : bestHour,
  }
}

export function hourLabel(h: number): string {
  const ap = h >= 12 ? "PM" : "AM"
  const hh = h % 12 === 0 ? 12 : h % 12
  const next = (h + 1) % 24
  const ap2 = next >= 12 ? "PM" : "AM"
  const hh2 = next % 12 === 0 ? 12 : next % 12
  return `${hh}:00 ${ap} - ${hh2}:00 ${ap2}`
}

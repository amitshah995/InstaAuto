import type { AuditReport, MediaKind } from "@/lib/audit/types"
import { HOOK_FORMULAS } from "@/lib/tools/text"

/**
 * Step 1 of the AI growth report: do ALL the arithmetic in code, so the model only has to interpret.
 * Nothing here calls an API. The model never sees raw Instagram responses, only this compact summary.
 */

export const GOALS = ["sales", "leads", "followers", "brand", "community"] as const
export type Goal = (typeof GOALS)[number]
export interface AiBrief {
  niche: string
  goal: Goal
  audience: string
  offer: string
  postsPerWeek: number
  language: "en" | "hinglish"
}

export interface PostFact {
  ref: string // P1 = most recent
  kind: MediaKind
  date: string // YYYY-MM-DD (local)
  weekday: string
  hourLocal: number
  likes: number | null
  comments: number
  interactions: number
  multipleOfMedian: number | null
  hook: string // first line of the caption, trimmed
  captionLength: number
  hashtags: number
  hasCta: boolean
  hasQuestion: boolean
  hookTypes: string[]
}
export interface CaptionTraits { avgLength: number; ctaSharePct: number; questionSharePct: number; avgHashtags: number; avgInteractions: number }

export interface Facts {
  account: { username: string; followers: number; following: number | null; totalPosts: number; tier: string; bioLength: number; hasWebsite: boolean }
  window: { postsAnalyzed: number; from: string; to: string; spanDays: number }
  engagement: { erPct: number | null; targetPct: number; deltaPct: number | null; medianInteractions: number; avgLikes: number; avgComments: number; likesHidden: boolean }
  cadence: { perWeek: number; avgGapDays: number | null; consistency: number | null }
  formats: { kind: MediaKind; count: number; avgInteractions: number }[]
  bestDay: string | null
  bestHourLocal: number | null
  weekdayAvg: Record<string, number>
  topPosts: PostFact[]
  bottomPosts: PostFact[]
  topVsBottom: { top: CaptionTraits; bottom: CaptionTraits } | null
  posts: PostFact[]
  confidence: "low" | "medium" | "high"
  limits: string[]
}

const CTA_RE = /\b(dm|comment|link in bio|whatsapp|book|order|shop|buy|call|contact|sign ?up|subscribe|swipe|tag a friend|save this|share|follow|click|tap|join|get)\b/i
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const r1 = (n: number) => Math.round(n * 10) / 10
const median = (xs: number[]) => {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b), m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function traits(ps: PostFact[]): CaptionTraits {
  return {
    avgLength: Math.round(mean(ps.map((p) => p.captionLength))),
    ctaSharePct: ps.length ? Math.round((ps.filter((p) => p.hasCta).length / ps.length) * 100) : 0,
    questionSharePct: ps.length ? Math.round((ps.filter((p) => p.hasQuestion).length / ps.length) * 100) : 0,
    avgHashtags: r1(mean(ps.map((p) => p.hashtags))),
    avgInteractions: Math.round(mean(ps.map((p) => p.interactions))),
  }
}

export function buildFacts(report: AuditReport, tzOffsetMin = 330): Facts {
  const ins = report.insights
  const profile = report.profile
  const raw = report.posts ?? []
  if (!ins || !profile || raw.length === 0) throw new Error("Report has no post data. Run a new audit first.")

  const interactions = raw.map((p) => (p.likes ?? 0) + p.comments)
  const med = median(interactions)

  const posts: PostFact[] = raw.map((p, i) => {
    const local = new Date(new Date(p.timestamp).getTime() + tzOffsetMin * 60_000)
    const firstLine = (p.caption.split("\n").find((l) => l.trim()) ?? "").trim()
    return {
      ref: `P${i + 1}`,
      kind: p.kind,
      date: local.toISOString().slice(0, 10),
      weekday: WEEKDAYS[local.getUTCDay()],
      hourLocal: local.getUTCHours(),
      likes: p.likes,
      comments: p.comments,
      interactions: interactions[i],
      multipleOfMedian: med > 0 ? r1(interactions[i] / med) : null,
      hook: firstLine.slice(0, 120),
      captionLength: [...p.caption].length,
      hashtags: (p.caption.match(/#[\p{L}\p{N}_]+/gu) || []).length,
      hasCta: CTA_RE.test(p.caption),
      hasQuestion: /\?/.test(p.caption),
      hookTypes: HOOK_FORMULAS.filter((f) => f.re.test(firstLine)).map((f) => f.name),
    }
  })

  const ranked = [...posts].sort((a, b) => b.interactions - a.interactions)
  const n = posts.length
  const k = n >= 8 ? 3 : n >= 4 ? 2 : 1
  const topPosts = ranked.slice(0, k)
  const bottomPosts = n >= 2 ? ranked.slice(-k).reverse() : []

  const dayBuckets: Record<string, number[]> = {}
  const hourBuckets: Record<number, number[]> = {}
  posts.forEach((p) => {
    ;(dayBuckets[p.weekday] ||= []).push(p.interactions)
    ;(hourBuckets[p.hourLocal] ||= []).push(p.interactions)
  })
  const weekdayAvg: Record<string, number> = {}
  for (const [d, xs] of Object.entries(dayBuckets)) weekdayAvg[d] = Math.round(mean(xs))
  const best = (b: Record<string | number, number[]>) => {
    let key: string | null = null, v = -1
    for (const [kk, xs] of Object.entries(b)) if (mean(xs) > v) { v = mean(xs); key = kk }
    return key
  }
  const bestHour = n >= 4 ? best(hourBuckets) : null
  const bestDay = n >= 4 ? best(dayBuckets) : null

  const times = raw.map((p) => +new Date(p.timestamp))
  const from = new Date(Math.min(...times)).toISOString().slice(0, 10)
  const to = new Date(Math.max(...times)).toISOString().slice(0, 10)

  const limits = [
    "No views, reach, saves, shares or watch-time data is available (Instagram Login does not provide it). Performance here means likes + comments, compared with the account's own median.",
    "Only the most recent posts were read, not the whole account history.",
  ]
  if (ins.likesHidden) limits.push("Like counts are hidden on this account, so performance uses comments only and is very rough.")
  if (n < 10) limits.push(`Only ${n} posts were available, so patterns are tentative.`)

  return {
    account: { username: report.username, followers: profile.followers, following: profile.following ?? null, totalPosts: profile.posts, tier: `${ins.tier.label} (${ins.tier.range})`, bioLength: (profile.bio ?? "").trim().length, hasWebsite: !!profile.website },
    window: { postsAnalyzed: n, from, to, spanDays: Math.max(1, Math.round((Math.max(...times) - Math.min(...times)) / 86_400_000)) },
    engagement: { erPct: ins.erPct, targetPct: ins.targetPct, deltaPct: ins.deltaPct, medianInteractions: Math.round(med), avgLikes: ins.avgLikes, avgComments: ins.avgComments, likesHidden: ins.likesHidden },
    cadence: ins.cadence,
    formats: ins.formats,
    bestDay,
    bestHourLocal: bestHour === null ? null : Number(bestHour),
    weekdayAvg,
    topPosts,
    bottomPosts,
    topVsBottom: n >= 6 ? { top: traits(topPosts), bottom: traits(bottomPosts) } : null,
    posts,
    confidence: n >= 20 ? "high" : n >= 10 ? "medium" : "low",
    limits,
  }
}

import type {
  AuditReport,
  AuditStats,
  AuditTeaser,
  CategoryId,
  CategoryScore,
  Finding,
  ProfileSnapshot,
  Severity,
} from "./types"

/**
 * Pure scoring. No I/O, no Instagram knowledge.
 *
 * IMPORTANT: every threshold below is a HEURISTIC, not an official or industry-certified
 * benchmark. They are deliberately collected in TUNING so they can be adjusted in one place,
 * and the report says so (see METHODOLOGY).
 */
export const TUNING = {
  weights: {
    profile: 15,
    consistency: 20,
    engagement: 25,
    content_mix: 15,
    captions: 10,
    lead_capture: 15,
  } as Record<CategoryId, number>,
  // Engagement-rate targets (avg likes+comments / followers) by audience size.
  engagementTargetPct: [
    { maxFollowers: 10_000, pct: 4 },
    { maxFollowers: 100_000, pct: 2.5 },
    { maxFollowers: 1_000_000, pct: 1.5 },
    { maxFollowers: Infinity, pct: 1 },
  ],
  postsPerMonthTarget: 12,
  reelShareTarget: 0.3,
  captionLengthIdeal: { min: 50, max: 400 },
  hashtagsIdeal: { min: 3, max: 15 },
  recentPostsForEngagement: 12,
}

export const METHODOLOGY =
  "Scores are computed from publicly visible data on your most recent posts using adjustable " +
  "heuristics (not official Instagram benchmarks). Treat them as a starting point, not a verdict."

const LABELS: Record<CategoryId, string> = {
  profile: "Profile & bio",
  consistency: "Posting consistency",
  engagement: "Engagement",
  content_mix: "Content mix",
  captions: "Captions & hashtags",
  lead_capture: "Lead capture",
}

const CTA_RE =
  /\b(dm|comment|link in bio|whatsapp|book|order|shop|buy|call|contact|sign ?up|subscribe|swipe|tag a friend|save this|share)\b/i
const BIO_CTA_RE = /\b(dm|book|order|shop|buy|call|contact|whatsapp|email|link|apply|join|start|get)\b/i
const clamp = (n: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, n))
const pct = (n: number) => Math.round(n * 100)

function hashtagCount(caption: string): number {
  return (caption.match(/#[\p{L}\p{N}_]+/gu) || []).length
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
}

function gradeFor(score: number): AuditReport["grade"] {
  if (score >= 85) return "A"
  if (score >= 70) return "B"
  if (score >= 55) return "C"
  if (score >= 40) return "D"
  return "F"
}

export function computeStats(p: ProfileSnapshot, now = new Date()): AuditStats {
  const media = p.media
  const cutoff = now.getTime() - 30 * 86_400_000
  const last30 = media.filter((m) => new Date(m.timestamp).getTime() >= cutoff)

  // Engagement rate needs like counts; if likes are hidden fall back to comments only.
  const recent = media.slice(0, TUNING.recentPostsForEngagement)
  let engagementRatePct: number | null = null
  if (recent.length && p.followersCount > 0) {
    const interactions = recent.map((m) => (m.likeCount ?? 0) + m.commentCount)
    engagementRatePct = (mean(interactions) / p.followersCount) * 100
  }

  return {
    followers: p.followersCount,
    postsAnalyzed: media.length,
    postsLast30d: last30.length,
    engagementRatePct: engagementRatePct === null ? null : Math.round(engagementRatePct * 100) / 100,
    reelSharePct: media.length ? pct(media.filter((m) => m.kind === "reel").length / media.length) : 0,
    avgCaptionLength: Math.round(mean(media.map((m) => m.caption.length))),
    avgHashtags: Math.round(mean(media.map((m) => hashtagCount(m.caption))) * 10) / 10,
    ctaCaptionSharePct: media.length ? pct(media.filter((m) => CTA_RE.test(m.caption)).length / media.length) : 0,
  }
}

export function scoreProfile(p: ProfileSnapshot, now = new Date()): AuditReport {
  const s = computeStats(p, now)
  const findings: Finding[] = []
  const add = (f: Omit<Finding, "id"> & { id?: string }) =>
    findings.push({ id: f.id ?? `${f.category}-${findings.length + 1}`, ...f })

  // ---- profile (0..1)
  const bio = (p.biography ?? "").trim()
  let profile = 0
  if (p.hasProfilePicture) profile += 0.2
  if (bio.length >= 40) profile += 0.3
  else if (bio.length > 0) profile += 0.15
  if (p.website) profile += 0.25
  if (BIO_CTA_RE.test(bio)) profile += 0.25
  if (!bio) {
    add({ category: "profile", severity: "high", title: "Your bio is empty",
      detail: "Visitors cannot tell what you offer or why they should follow.",
      fix: "Write a one-line value statement, who you help, and one clear next step." })
  } else if (bio.length < 40) {
    add({ category: "profile", severity: "medium", title: "Your bio is very short",
      detail: `Only ${bio.length} characters used out of 150.`,
      fix: "Add what you offer, who it is for, and a call to action." })
  }
  if (!p.website) {
    add({ category: "profile", severity: "high", title: "No link in your profile",
      detail: "There is nowhere for interested visitors to go next.",
      fix: "Add a link to your store, booking page, WhatsApp or a link-in-bio page." })
  }
  if (bio && !BIO_CTA_RE.test(bio)) {
    add({ category: "profile", severity: "medium", title: "Your bio has no call to action",
      detail: "A bio without a next step turns profile visits into dead ends.",
      fix: 'End your bio with an action, e.g. "DM \'PRICE\' to order" or "Book a call below".' })
  }

  // ---- consistency
  const consistency = clamp(s.postsLast30d / TUNING.postsPerMonthTarget)
  if (s.postsLast30d === 0) {
    add({ category: "consistency", severity: "high", title: "No posts in the last 30 days",
      detail: "The algorithm and your followers both forget accounts that go quiet.",
      fix: `Plan ${TUNING.postsPerMonthTarget} posts a month and schedule them in advance.` })
  } else if (s.postsLast30d < TUNING.postsPerMonthTarget / 2) {
    add({ category: "consistency", severity: "medium", title: "Posting frequency is low",
      detail: `${s.postsLast30d} posts in the last 30 days (target ~${TUNING.postsPerMonthTarget}).`,
      fix: "Batch-create content weekly and use a scheduler so posting does not depend on mood." })
  }

  // ---- engagement
  const target = TUNING.engagementTargetPct.find((t) => p.followersCount <= t.maxFollowers)!.pct
  const engagement = s.engagementRatePct === null ? 0.5 : clamp(s.engagementRatePct / target)
  if (s.engagementRatePct !== null && s.engagementRatePct < target * 0.5) {
    add({ category: "engagement", severity: "high", title: "Engagement is well below target for your size",
      detail: `About ${s.engagementRatePct}% per post versus a ~${target}% working target for accounts your size.`,
      fix: "Ask questions, use hooks in the first line, and reply to every early comment." })
  } else if (s.engagementRatePct !== null && s.engagementRatePct < target) {
    add({ category: "engagement", severity: "medium", title: "Engagement is slightly under target",
      detail: `About ${s.engagementRatePct}% per post versus a ~${target}% working target.`,
      fix: "Double down on your top posts' formats and topics." })
  }

  // ---- content mix
  const formats = new Set(p.media.map((m) => m.kind)).size
  const reelShare = s.reelSharePct / 100
  const contentMix = clamp(
    0.6 * clamp(reelShare / TUNING.reelShareTarget) + 0.4 * clamp((formats - 1) / 2)
  )
  if (p.media.length && reelShare < TUNING.reelShareTarget / 2) {
    add({ category: "content_mix", severity: "high", title: "Almost no Reels",
      detail: `Reels are ${s.reelSharePct}% of your recent posts. Reels are the main way non-followers discover accounts.`,
      fix: "Aim for at least 1 in 3 posts being a Reel." })
  }
  if (p.media.length >= 6 && formats < 2) {
    add({ category: "content_mix", severity: "medium", title: "You only use one content format",
      detail: "Mixing Reels, carousels and images reaches different audiences.",
      fix: "Add carousels for saves and shares, Reels for reach." })
  }

  // ---- captions & hashtags
  const lenOk = s.avgCaptionLength >= TUNING.captionLengthIdeal.min && s.avgCaptionLength <= TUNING.captionLengthIdeal.max
  const tagOk = s.avgHashtags >= TUNING.hashtagsIdeal.min && s.avgHashtags <= TUNING.hashtagsIdeal.max
  const captions = (lenOk ? 0.5 : s.avgCaptionLength > 0 ? 0.2 : 0) + (tagOk ? 0.5 : s.avgHashtags > 0 ? 0.25 : 0)
  if (p.media.length && s.avgCaptionLength < TUNING.captionLengthIdeal.min) {
    add({ category: "captions", severity: "medium", title: "Captions are too short",
      detail: `Average caption is ${s.avgCaptionLength} characters.`,
      fix: "Open with a hook, add value, and close with a question or call to action." })
  }
  if (p.media.length && s.avgHashtags < TUNING.hashtagsIdeal.min) {
    add({ category: "captions", severity: "low", title: "Few or no hashtags",
      detail: `Average ${s.avgHashtags} hashtags per post.`,
      fix: `Use ${TUNING.hashtagsIdeal.min}-${TUNING.hashtagsIdeal.max} specific, relevant hashtags.` })
  }

  // ---- lead capture (the DM-automation opportunity)
  const ctaShare = s.ctaCaptionSharePct / 100
  const lead = clamp(0.5 * clamp(ctaShare / 0.5) + 0.25 * (p.website ? 1 : 0) + 0.25 * (BIO_CTA_RE.test(bio) ? 1 : 0))
  if (p.media.length && ctaShare < 0.25) {
    add({ category: "lead_capture", severity: "high", title: "Posts rarely ask people to take an action",
      detail: `Only ${s.ctaCaptionSharePct}% of recent captions include a call to action.`,
      fix: 'Add prompts like "Comment LINK and I will DM it to you" and automate the reply.' })
  } else if (p.media.length && s.postsLast30d > 0) {
    add({ category: "lead_capture", severity: "medium", title: "Comments are likely going unconverted",
      detail: `${s.ctaCaptionSharePct}% of your captions ask for comments or DMs. Without automatic replies, each one is manual work and slow answers lose buyers.`,
      fix: "Automate comment-to-DM replies so every interested commenter gets an instant answer." })
  }

  const parts: Record<CategoryId, number> = {
    profile: clamp(profile), consistency, engagement, content_mix: contentMix, captions, lead_capture: lead,
  }
  const categories: CategoryScore[] = (Object.keys(parts) as CategoryId[]).map((id) => ({
    id, label: LABELS[id], weight: TUNING.weights[id], score: Math.round(parts[id] * 100),
  }))
  const totalWeight = categories.reduce((a, c) => a + c.weight, 0)
  const score = Math.round(categories.reduce((a, c) => a + c.score * c.weight, 0) / totalWeight)

  const order: Record<Severity, number> = { high: 0, medium: 1, low: 2 }
  findings.sort((a, b) => order[a.severity] - order[b.severity])

  return {
    username: p.username, score, grade: gradeFor(score), categories, findings, stats: s,
    methodology: METHODOLOGY, generatedAt: now.toISOString(),
  }
}

/** The ONLY shape a logged-out visitor may receive. Built from the report; leaks no detail. */
export function toTeaser(report: AuditReport): AuditTeaser {
  const shown = report.findings.slice(0, 2)
  return {
    username: report.username,
    score: report.score,
    grade: report.grade,
    topFindings: shown.map((f) => ({ title: f.title, severity: f.severity })),
    lockedFindingsCount: Math.max(0, report.findings.length - shown.length),
    followers: report.stats.followers,
  }
}

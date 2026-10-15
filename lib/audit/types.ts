/**
 * Source-agnostic shapes for the audit. The lookup provider (lib/audit/lookup.ts) maps
 * whatever the Instagram API returns into `ProfileSnapshot`; scoring never sees raw API data.
 */

export type MediaKind = "reel" | "carousel" | "image" | "video" | "other"

export interface MediaSample {
  kind: MediaKind
  timestamp: string // ISO
  caption: string
  /** Undefined when the owner hides like counts. */
  likeCount?: number
  commentCount: number
}

export interface ProfileSnapshot {
  username: string
  name?: string
  biography?: string
  website?: string
  hasProfilePicture: boolean
  followersCount: number
  followsCount?: number
  mediaCount: number
  /** Most recent first. Up to ~30 items. */
  media: MediaSample[]
  fetchedAt: string // ISO
}

export type CategoryId =
  | "profile"
  | "consistency"
  | "engagement"
  | "content_mix"
  | "captions"
  | "lead_capture"

export type Severity = "high" | "medium" | "low"

export interface Finding {
  id: string
  category: CategoryId
  severity: Severity
  title: string
  detail: string
  fix: string
}

export interface CategoryScore {
  id: CategoryId
  label: string
  weight: number
  /** 0-100 */
  score: number
}

export interface AuditStats {
  followers: number
  postsAnalyzed: number
  postsLast30d: number
  engagementRatePct: number | null
  reelSharePct: number
  avgCaptionLength: number
  avgHashtags: number
  ctaCaptionSharePct: number
}

/** Full, gated payload. Never send to anonymous callers. */
export interface AuditReport {
  username: string
  score: number
  grade: "A" | "B" | "C" | "D" | "F"
  categories: CategoryScore[]
  findings: Finding[]
  stats: AuditStats
  /** Honest labelling: how the benchmarks used were derived. */
  methodology: string
  generatedAt: string
}

/** The only thing a logged-out visitor may see. No finding detail, no fixes, no categories. */
export interface AuditTeaser {
  username: string
  score: number
  grade: AuditReport["grade"]
  /** Titles only, highest severity first. */
  topFindings: { title: string; severity: Severity }[]
  lockedFindingsCount: number
  followers: number
}

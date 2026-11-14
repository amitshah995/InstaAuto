/**
 * Lead status + score. Pure.
 *
 * Who calls this: lib/agent/runtime.ts (after each captured detail or handoff), lib/agent/overview.ts, the settings API
 * (clampScores) and tests.
 * Why a pure function: the score is a business rule the owner edits (numbers in Settings), so it must be predictable.
 * Rules: score never goes down; a captured lead is never demoted by a handoff; handoff keeps the score it had.
 */
export type LeadStatus = "new" | "engaged" | "email_lead" | "wa_lead" | "handoff"
export const LEAD_STATUSES: LeadStatus[] = ["new", "engaged", "email_lead", "wa_lead", "handoff"]

export interface ScoreConfig { wa_lead: number; email_lead: number; engaged: number }
/** Editable defaults. Owners override them per account in Settings. */
export const DEFAULT_SCORES: ScoreConfig = { wa_lead: 95, email_lead: 60, engaged: 30 }

/** Merge user-supplied numbers over a base, clamped to whole numbers 0..100. Junk falls back to the base. */
export function clampScores(input: unknown, base: ScoreConfig = DEFAULT_SCORES): ScoreConfig {
  const src = input && typeof input === "object" ? (input as Record<string, unknown>) : {}
  const pick = (k: keyof ScoreConfig) => {
    const v = Number(src[k])
    return Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : base[k]
  }
  return { wa_lead: pick("wa_lead"), email_lead: pick("email_lead"), engaged: pick("engaged") }
}

export type LeadEvent = "engaged" | "email_captured" | "wa_captured" | "handoff"
export interface LeadSnapshot { status: LeadStatus; score: number }

export function isLeadStatus(v: unknown): v is LeadStatus {
  return typeof v === "string" && (LEAD_STATUSES as string[]).includes(v)
}

export function applyLeadEvent(cur: LeadSnapshot, ev: LeadEvent, cfg: ScoreConfig = DEFAULT_SCORES): LeadSnapshot {
  const score = Number.isFinite(cur.score) ? cur.score : 0
  switch (ev) {
    case "wa_captured":
      return { status: "wa_lead", score: Math.max(score, cfg.wa_lead) }
    case "email_captured":
      return { status: cur.status === "wa_lead" ? "wa_lead" : "email_lead", score: Math.max(score, cfg.email_lead) }
    case "engaged":
      return cur.status === "new" ? { status: "engaged", score: Math.max(score, cfg.engaged) } : { status: cur.status, score }
    case "handoff":
      return { status: cur.status === "wa_lead" || cur.status === "email_lead" ? cur.status : "handoff", score }
  }
}

/** Buckets for the overview chart. */
export const SCORE_BUCKETS = ["0-24", "25-49", "50-74", "75-100"] as const
export function scoreBucket(score: number): (typeof SCORE_BUCKETS)[number] {
  const s = Number.isFinite(score) ? score : 0
  return s >= 75 ? "75-100" : s >= 50 ? "50-74" : s >= 25 ? "25-49" : "0-24"
}

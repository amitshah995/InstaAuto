import { z } from "zod"
import type { Facts } from "./facts"

/** The ONLY shape the model may return. Anything else is rejected and retried once. */
const ref = z.string().regex(/^P\d{1,3}$/)
const text = (max: number) => z.string().trim().min(1).max(max)
const format = z.enum(["reel", "carousel", "image", "video", "story"])

const partA = z.object({
  summary: z.object({
    headline: text(140),
    verdict: text(700),
    confidence: z.enum(["low", "medium", "high"]),
    confidenceNote: text(300),
  }),
  whatWorked: z.array(z.object({ postRef: ref, why: text(300), evidence: text(200) })).min(1).max(4),
  whatIsntWorking: z.array(z.object({ issue: text(160), evidence: text(240), fix: text(300) })).min(1).max(5),
  patterns: z.array(z.object({ pattern: text(160), evidence: text(240), howToUse: text(260) })).min(2).max(6),
  contentPillars: z.array(z.object({ name: text(60), sharePct: z.number().min(0).max(100), performance: z.enum(["above", "average", "below"]), note: text(200) })).min(2).max(5),
})
const partB = z.object({
  nextContent: z.array(z.object({ title: text(120), format, hook: text(160), whyItShouldWork: text(240), cta: text(160) })).min(6).max(10),
  plan30: z.array(z.object({
    week: z.number().int().min(1).max(4),
    focus: text(140),
    posts: z.array(z.object({ day: text(20), ideaNumber: z.number().int().min(1).max(10) })).min(1).max(7),
  })).length(4),
  roadmap: z.array(z.object({ phase: text(40), goal: text(200), actions: z.array(text(200)).min(2).max(5), metric: text(160) })).length(3),
})
export const PartASchema = partA.extend({
  quickWins: z.array(text(200)).min(3).max(3),
  dataLimits: z.array(text(240)).min(1).max(5),
})
export const PartBSchema = partB
export const AiReportSchema = PartASchema.merge(PartBSchema)
export type AiReport = z.infer<typeof AiReportSchema>

/** Extra checks zod cannot express: every post reference must exist, and claims must not exceed the data. */
export function checkGrounding(r: Partial<AiReport>, facts: Facts, postsPerWeek?: number): string[] {
  const problems: string[] = []
  const refs = new Set(facts.posts.map((p) => p.ref))
  ;(r.whatWorked ?? []).forEach((w) => { if (!refs.has(w.postRef)) problems.push(`whatWorked cites unknown post ${w.postRef}`) })
  if (r.summary && facts.confidence === "low" && r.summary.confidence !== "low") problems.push("summary.confidence must be low when fewer than 10 posts were analyzed")
  if (r.summary && facts.confidence === "medium" && r.summary.confidence === "high") problems.push("summary.confidence cannot be high with fewer than 20 posts")
  if (r.plan30 && r.nextContent) {
    const n = r.nextContent.length
    r.plan30.forEach((w) => {
      if (w.posts.some((p) => p.ideaNumber > n)) problems.push(`plan30 week ${w.week} uses an ideaNumber above ${n} (only ${n} ideas exist)`)
      if (postsPerWeek && w.posts.length > postsPerWeek) problems.push(`plan30 week ${w.week} has ${w.posts.length} posts but the owner can make ${postsPerWeek} per week`)
    })
  }
  const all = JSON.stringify(r).toLowerCase()
  for (const banned of ["buy followers", "follow/unfollow", "follow-unfollow", "engagement pod", "mass dm", "guaranteed"]) {
    if (all.includes(banned)) problems.push(`report contains disallowed advice or claim: "${banned}"`)
  }
  return problems
}

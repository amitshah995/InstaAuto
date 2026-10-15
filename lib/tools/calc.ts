import { TUNING } from "@/lib/audit/score"
import { TIERS } from "@/lib/audit/insights"

const num = (n: unknown) => (typeof n === "number" && isFinite(n) && n > 0 ? n : 0)
const r1 = (n: number) => Math.round(n * 10) / 10
const r2 = (n: number) => Math.round(n * 100) / 100

// ---------------------------------------------------------------- engagement
export type EngagementLevel = "low" | "below" | "good" | "excellent"
export function engagement(i: { followers: number; likes: number; comments: number; saves?: number; shares?: number }) {
  const followers = num(i.followers)
  const interactions = num(i.likes) + num(i.comments) + num(i.saves) + num(i.shares)
  const tier = TIERS.find((t) => followers <= t.maxFollowers)!
  const targetPct = TUNING.engagementTargetPct.find((t) => followers <= t.maxFollowers)!.pct
  const erPct = followers > 0 ? r2((interactions / followers) * 100) : null
  const ratio = erPct === null ? null : erPct / targetPct
  const level: EngagementLevel | null = ratio === null ? null : ratio < 0.5 ? "low" : ratio < 1 ? "below" : ratio < 1.5 ? "good" : "excellent"
  const neededPerPost = followers > 0 ? Math.ceil((targetPct / 100) * followers) : 0
  return { followers, interactions, tier, targetPct, erPct, level, neededPerPost }
}

// ---------------------------------------------------------------- comment to DM
export interface C2DInput {
  postsPerMonth: number; avgComments: number; intentPct: number
  manualReplyPct: number; autoReplyPct: number; openPct: number; clickPct: number; convPct: number; valuePerSale: number
}
export function commentToDm(i: C2DInput) {
  const intent = num(i.postsPerMonth) * num(i.avgComments) * (Math.min(100, num(i.intentPct)) / 100)
  const run = (replyPct: number) => {
    const dms = intent * (Math.min(100, num(replyPct)) / 100)
    const opened = dms * (Math.min(100, num(i.openPct)) / 100)
    const clicks = opened * (Math.min(100, num(i.clickPct)) / 100)
    const sales = clicks * (Math.min(100, num(i.convPct)) / 100)
    return { dms: Math.round(dms), clicks: Math.round(clicks), sales: r1(sales), revenue: Math.round(sales * num(i.valuePerSale)) }
  }
  const manual = run(i.manualReplyPct)
  const auto = run(i.autoReplyPct)
  return { intentComments: Math.round(intent), manual, auto, extraRevenue: auto.revenue - manual.revenue, extraSales: r1(auto.sales - manual.sales) }
}

// ---------------------------------------------------------------- DM ROI
export interface RoiInput { dmsPerDay: number; minutesPerDm: number; hourlyCost: number; automatablePct: number; toolCost: number; extraSales: number; orderValue: number }
export function dmRoi(i: RoiInput) {
  const hoursSaved = (num(i.dmsPerDay) * 30 * num(i.minutesPerDm) * (Math.min(100, num(i.automatablePct)) / 100)) / 60
  const timeValue = hoursSaved * num(i.hourlyCost)
  const extraRevenue = num(i.extraSales) * num(i.orderValue)
  const gain = timeValue + extraRevenue
  const net = gain - num(i.toolCost)
  const roi = num(i.toolCost) > 0 ? r1(net / num(i.toolCost)) : null
  const paybackDays = gain > 0 && num(i.toolCost) > 0 ? Math.max(1, Math.ceil((num(i.toolCost) / gain) * 30)) : null
  return { hoursSaved: r1(hoursSaved), timeValue: Math.round(timeValue), extraRevenue: Math.round(extraRevenue), gain: Math.round(gain), net: Math.round(net), roi, paybackDays }
}

// ---------------------------------------------------------------- influencer pricing
export const NICHES: Record<string, number> = {
  "Fashion": 1, "Beauty": 1.1, "Fitness": 1, "Food": 0.9, "Travel": 1, "Tech": 1.3, "Finance": 1.6,
  "Education": 1.1, "Business & marketing": 1.4, "Lifestyle": 1, "Gaming": 0.9, "Other": 1,
}
export const FORMATS: { id: string; label: string; mult: number }[] = [
  { id: "post", label: "Static post", mult: 1 },
  { id: "carousel", label: "Carousel", mult: 1.1 },
  { id: "reel", label: "Reel", mult: 1.5 },
  { id: "story", label: "Story (single frame)", mult: 0.4 },
]
// Rupees per 1,000 followers (low, high) before multipliers. A rough rule of thumb, not market data.
const PER_K: { maxFollowers: number; low: number; high: number }[] = [
  { maxFollowers: 10_000, low: 150, high: 350 },
  { maxFollowers: 100_000, low: 100, high: 250 },
  { maxFollowers: 1_000_000, low: 60, high: 150 },
  { maxFollowers: Infinity, low: 40, high: 100 },
]
const roundTo = (n: number) => (n >= 10_000 ? Math.round(n / 500) * 500 : n >= 1000 ? Math.round(n / 100) * 100 : Math.round(n / 50) * 50)
export function influencerRates(i: { followers: number; erPct: number; niche: string }) {
  const followers = num(i.followers)
  const band = PER_K.find((b) => followers <= b.maxFollowers)!
  const target = TUNING.engagementTargetPct.find((t) => followers <= t.maxFollowers)!.pct
  const eng = Math.min(1.6, Math.max(0.6, num(i.erPct) > 0 ? num(i.erPct) / target : 1))
  const niche = NICHES[i.niche] ?? 1
  return FORMATS.map((f) => {
    const base = (followers / 1000) * f.mult * niche * eng
    return { id: f.id, label: f.label, low: roundTo(base * band.low), high: roundTo(base * band.high) }
  })
}

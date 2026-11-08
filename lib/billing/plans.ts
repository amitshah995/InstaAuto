/**
 * Plan catalogue and pure billing math (no database, no network, no app imports).
 *
 * Who calls this: lib/billing/usage.ts (quota checks), the billing API routes, the billing page,
 * the pricing page and the unit tests.
 * Why one file: price and limits must be editable in ONE place, and the maths (which plan is in
 * force, how much quota is left) must be testable without a server.
 *
 * Pricing model: FLAT monthly price in INR. Limits are DMs sent per month and AI runs per day.
 * There is deliberately NO per-contact or per-follower billing (the main complaint about
 * contact-based tools).
 */

export type PlanId = "free" | "starter" | "pro"

export interface Plan {
  id: PlanId
  name: string
  /** Flat monthly price in whole rupees (GST handling is a human decision, see engineer report). */
  priceInrMonthly: number
  /** DMs sent per calendar month (UTC). */
  dmsPerMonth: number
  /** AI generations per day (UTC). Covers flow AI-reply, AI fallback reply and AI growth reports. */
  aiRunsPerDay: number
  /** Team members (including the owner). */
  seats: number
  /** Limits only: features are NOT gated by plan, so never list a feature here that the free plan lacks. */
  highlights: string[]
}

/**
 * ILLUSTRATIVE, EDITABLE DEFAULTS. These numbers are placeholders chosen to sit near the low end
 * of the market (CreatorFlow: $15 for 5,000 DMs). Change them here and redeploy; also create
 * matching plans in Razorpay and put their ids in RAZORPAY_PLAN_ID_STARTER / _PRO.
 * They are NOT shown as real prices anywhere unless BILLING_ENABLED=1.
 */
export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    priceInrMonthly: 0,
    dmsPerMonth: 500,
    aiRunsPerDay: 3,
    seats: 1,
    highlights: ["Comment-to-DM and story replies", "DM flows, contacts and tags", "Reports and the free audit"],
  },
  starter: {
    id: "starter",
    name: "Starter",
    priceInrMonthly: 499,
    dmsPerMonth: 5000,
    aiRunsPerDay: 20,
    seats: 2,
    highlights: ["Every feature in Free", "10 times the monthly DMs", "AI replies at 20 runs a day", "Team seats for a helper"],
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceInrMonthly: 1499,
    dmsPerMonth: 25000,
    aiRunsPerDay: 100,
    seats: 5,
    highlights: ["Every feature in Free", "5 times the DMs of Starter", "AI replies at 100 runs a day", "Seats for a small team"],
  },
}

export const PLAN_ORDER: PlanId[] = ["free", "starter", "pro"]

export function getPlan(id: string | null | undefined): Plan {
  return PLANS[(id as PlanId) in PLANS ? (id as PlanId) : "free"]
}

/** Format whole rupees for display, e.g. 1499 -> "₹1,499". */
export function formatInr(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`
}

// ---------------------------------------------------------------------------
// Which plan is in force
// ---------------------------------------------------------------------------

export interface SubscriptionLike {
  plan_id: string
  status: string
  current_period_end?: string | Date | null
}

/**
 * Plan a user is entitled to RIGHT NOW.
 * - active / authenticated / pending (Razorpay is still retrying a failed charge): paid plan.
 * - cancelled at cycle end: paid plan until the period ends, then free (they paid for it).
 * - halted / expired / completed / created (never paid) / paused: free.
 */
export function effectivePlanId(sub: SubscriptionLike | null | undefined, now: Date = new Date()): PlanId {
  if (!sub || !(sub.plan_id in PLANS) || sub.plan_id === "free") return "free"
  const plan = sub.plan_id as PlanId
  if (["active", "authenticated", "pending"].includes(sub.status)) return plan
  if (sub.status === "cancelled" && sub.current_period_end) {
    return new Date(sub.current_period_end).getTime() > now.getTime() ? plan : "free"
  }
  return "free"
}

// ---------------------------------------------------------------------------
// Feature flags
// ---------------------------------------------------------------------------

type Env = Record<string, string | undefined>

/** All Razorpay secrets and at least one plan id present. Never reads or returns secret values. */
export function razorpayConfigured(env: Env = process.env): boolean {
  return !!(
    env.RAZORPAY_KEY_ID &&
    env.RAZORPAY_KEY_SECRET &&
    env.RAZORPAY_WEBHOOK_SECRET &&
    (env.RAZORPAY_PLAN_ID_STARTER || env.RAZORPAY_PLAN_ID_PRO)
  )
}

/** Quotas are enforced and prices are shown as live only when explicitly switched on AND configured. */
export function billingEnabled(env: Env = process.env): boolean {
  return env.BILLING_ENABLED === "1" && razorpayConfigured(env)
}

/** Razorpay plan id for one of our plans, or null if not configured. */
export function razorpayPlanIdFor(plan: PlanId, env: Env = process.env): string | null {
  if (plan === "starter") return env.RAZORPAY_PLAN_ID_STARTER || null
  if (plan === "pro") return env.RAZORPAY_PLAN_ID_PRO || null
  return null
}

// ---------------------------------------------------------------------------
// Quota math
// ---------------------------------------------------------------------------

export type QuotaState = "ok" | "warn" | "limit"

export interface QuotaView {
  used: number
  limit: number
  remaining: number
  percent: number
  state: QuotaState
}

/** Share of the limit at which the dashboard starts warning. */
export const WARN_AT = 0.8

export function evaluateQuota(used: number, limit: number): QuotaView {
  const safeUsed = Math.max(0, used)
  const remaining = Math.max(0, limit - safeUsed)
  const percent = limit > 0 ? Math.min(100, Math.round((safeUsed / limit) * 100)) : 100
  const state: QuotaState = safeUsed >= limit ? "limit" : safeUsed >= limit * WARN_AT ? "warn" : "ok"
  return { used: safeUsed, limit, remaining, percent, state }
}

/** Period keys used as counter buckets. UTC on purpose: one rule everywhere, no DST surprises. */
export function periodKeys(now: Date = new Date()) {
  const iso = now.toISOString()
  return { month: iso.slice(0, 7), day: iso.slice(0, 10) }
}

/** Friendly message shown instead of a raw error when a quota is hit. */
export function limitMessage(kind: "dm" | "ai", plan: Plan): string {
  if (kind === "dm") {
    return `You have used all ${plan.dmsPerMonth.toLocaleString("en-IN")} DMs included in the ${plan.name} plan this month. Upgrade your plan to keep automations sending, or wait for the monthly reset.`
  }
  return `You have used all ${plan.aiRunsPerDay} AI runs included in the ${plan.name} plan today. Try again tomorrow or upgrade your plan.`
}

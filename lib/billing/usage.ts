/**
 * Usage metering and quota enforcement (database side).
 *
 * Who calls this: lib/messaging/send-steps.ts (every DM), lib/messaging/flow-runner.ts,
 * the webhook's AI fallback, AI endpoints (audit AI report, flow AI reply), and the billing status route.
 * Why: flat plans only protect costs if every DM and AI run is counted and capped. Counting
 * happens even during the free beta (so the meter is real), but BLOCKING happens only when
 * billingEnabled() is true, so turning billing on is a deliberate switch.
 *
 * Reservation model: the counter is incremented BEFORE the send in one atomic statement that only
 * succeeds below the limit, then released if the send fails. Fails open (allows the send) if the
 * database is unreachable or migration 27 is missing: billing bugs must never silence automations.
 */
import { rawQuery } from "@/lib/supabase-server"
import {
  type Plan,
  type QuotaView,
  billingEnabled,
  effectivePlanId,
  evaluateQuota,
  getPlan,
  limitMessage,
  periodKeys,
} from "@/lib/billing/plans"

/** Effectively "no limit" for the not-enforcing (beta) case. */
const UNLIMITED = 2_000_000_000

export interface Entitlement {
  plan: Plan
  /** True when billing is switched on, so quotas actually block. */
  enforce: boolean
}

export interface SubscriptionRow {
  user_id: string
  plan_id: string
  status: string
  razorpay_subscription_id: string | null
  current_period_end: string | null
  cancel_at_cycle_end: boolean
}

export async function getSubscription(userId: string | number): Promise<SubscriptionRow | null> {
  try {
    const rows = await rawQuery<SubscriptionRow>(
      `SELECT user_id::text AS user_id, plan_id, status, razorpay_subscription_id, current_period_end, cancel_at_cycle_end
         FROM subscriptions WHERE user_id = $1`,
      [userId],
    )
    return rows[0] ?? null
  } catch {
    return null // table missing: everyone is on the free plan
  }
}

export async function getEntitlement(userId: string | number): Promise<Entitlement> {
  if (!billingEnabled()) return { plan: getPlan("free"), enforce: false }
  const sub = await getSubscription(userId)
  return { plan: getPlan(effectivePlanId(sub)), enforce: true }
}

async function reserve(userId: string | number, kind: "dm_month" | "ai_day", limit: number): Promise<boolean> {
  const { month, day } = periodKeys()
  const period = kind === "dm_month" ? month : day
  try {
    const rows = await rawQuery(
      `INSERT INTO usage_counters (user_id, kind, period, count) VALUES ($1,$2,$3,1)
       ON CONFLICT (user_id, kind, period) DO UPDATE SET count = usage_counters.count + 1
         WHERE usage_counters.count < $4
       RETURNING count`,
      [userId, kind, period, limit],
    )
    return rows.length > 0 // no row = the WHERE blocked the increment = limit reached
  } catch (e) {
    console.error("[usage] counter unavailable, allowing (is migration 27 run?):", (e as Error)?.message)
    return true
  }
}

async function release(userId: string | number, kind: "dm_month" | "ai_day"): Promise<void> {
  const { month, day } = periodKeys()
  try {
    await rawQuery(
      `UPDATE usage_counters SET count = GREATEST(0, count - 1) WHERE user_id=$1 AND kind=$2 AND period=$3`,
      [userId, kind, kind === "dm_month" ? month : day],
    )
  } catch {
    // best effort
  }
}

export interface ReserveResult {
  allowed: boolean
  /** Friendly text for the creator when blocked. */
  message?: string
}

/** Reserve one DM. Call releaseDm() if the send then fails so failures are not billed. */
export async function reserveDm(userId: string | number, ent?: Entitlement): Promise<ReserveResult> {
  const e = ent ?? (await getEntitlement(userId))
  const ok = await reserve(userId, "dm_month", e.enforce ? e.plan.dmsPerMonth : UNLIMITED)
  return ok ? { allowed: true } : { allowed: false, message: limitMessage("dm", e.plan) }
}

export const releaseDm = (userId: string | number) => release(userId, "dm_month")

/** Reserve one AI run (daily). AI runs are not refunded: the provider cost is spent either way. */
export async function reserveAiRun(userId: string | number): Promise<ReserveResult> {
  const e = await getEntitlement(userId)
  const ok = await reserve(userId, "ai_day", e.enforce ? e.plan.aiRunsPerDay : UNLIMITED)
  return ok ? { allowed: true } : { allowed: false, message: limitMessage("ai", e.plan) }
}

export interface UsageSummary {
  plan: Plan
  enforced: boolean
  dms: QuotaView
  ai: QuotaView
  periodResets: { dmsAt: string; aiAt: string }
}

export async function getUsageSummary(userId: string | number): Promise<UsageSummary> {
  const ent = await getEntitlement(userId)
  const { month, day } = periodKeys()
  let dmUsed = 0
  let aiUsed = 0
  try {
    const rows = await rawQuery<{ kind: string; count: number }>(
      `SELECT kind, count FROM usage_counters WHERE user_id=$1 AND ((kind='dm_month' AND period=$2) OR (kind='ai_day' AND period=$3))`,
      [userId, month, day],
    )
    dmUsed = rows.find((r) => r.kind === "dm_month")?.count ?? 0
    aiUsed = rows.find((r) => r.kind === "ai_day")?.count ?? 0
  } catch {
    // table missing: show zeros
  }
  const now = new Date()
  return {
    plan: ent.plan,
    enforced: ent.enforce,
    dms: evaluateQuota(dmUsed, ent.plan.dmsPerMonth),
    ai: evaluateQuota(aiUsed, ent.plan.aiRunsPerDay),
    periodResets: {
      dmsAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString(),
      aiAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString(),
    },
  }
}

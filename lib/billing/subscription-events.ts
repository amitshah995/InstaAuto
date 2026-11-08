/**
 * Maps Razorpay subscription webhook events to our subscriptions table.
 *
 * Who calls this: app/api/billing/webhook after the HMAC signature has been verified.
 * Why pure mapping is separate: the status mapping is the heart of "who is paid", so it is
 * unit-tested without a database.
 */
import { type PlanId, PLANS } from "./plans.ts"

/** Razorpay event name -> our stored status. Unknown events return null (ignored, not an error). */
export function statusForEvent(event: string): string | null {
  switch (event) {
    case "subscription.authenticated": return "authenticated"
    case "subscription.activated":
    case "subscription.charged":
    case "subscription.resumed": return "active"
    case "subscription.pending": return "pending"
    case "subscription.halted": return "halted"
    case "subscription.paused": return "paused"
    case "subscription.cancelled": return "cancelled"
    case "subscription.completed": return "completed"
    default: return null
  }
}

/** Which of our plans a Razorpay plan id belongs to, using the env mapping. */
export function planForRazorpayPlan(rzpPlanId: string | undefined, env: Record<string, string | undefined> = process.env): PlanId | null {
  if (!rzpPlanId) return null
  const candidates: PlanId[] = (Object.keys(PLANS) as PlanId[]).filter((p) => p !== "free")
  return candidates.find((p) => env[`RAZORPAY_PLAN_ID_${p.toUpperCase()}`] === rzpPlanId) ?? null
}

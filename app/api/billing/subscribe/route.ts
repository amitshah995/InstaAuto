/**
 * POST /api/billing/subscribe  { planId: "starter" | "pro" }
 * Creates a Razorpay subscription and returns what the browser needs to open Razorpay Checkout.
 * Who calls it: app/dashboard/billing/page.tsx. Needs billing enabled and the account's own session.
 */
import { type NextRequest, NextResponse } from "next/server"
import { authorizeUser } from "@/lib/auth"
import { rawQuery } from "@/lib/supabase-server"
import { type PlanId, billingEnabled, effectivePlanId, razorpayPlanIdFor } from "@/lib/billing/plans"
import { RazorpayError, createSubscription } from "@/lib/billing/razorpay"
import { getSubscription } from "@/lib/billing/usage"

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const auth = authorizeUser(request, body?.userId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  if (!billingEnabled()) return NextResponse.json({ error: "Billing not configured" }, { status: 503 })

  const planId = body?.planId as PlanId
  const rzpPlan = planId === "starter" || planId === "pro" ? razorpayPlanIdFor(planId) : null
  if (!rzpPlan) return NextResponse.json({ error: "That plan is not available" }, { status: 400 })

  // One live subscription at a time: changing plans = cancel first (keeps proration out of scope).
  const existing = await getSubscription(auth.userId)
  if (existing && effectivePlanId(existing) !== "free" && !existing.cancel_at_cycle_end) {
    return NextResponse.json({ error: "You already have an active plan. Cancel it first to switch." }, { status: 409 })
  }

  try {
    const sub = await createSubscription(rzpPlan, { user_id: auth.userId, plan: planId })
    // Stored as 'created' (still free) until payment is verified / the webhook confirms it.
    await rawQuery(
      `INSERT INTO subscriptions (user_id, plan_id, status, razorpay_subscription_id, razorpay_plan_id, cancel_at_cycle_end)
       VALUES ($1,$2,'created',$3,$4,FALSE)
       ON CONFLICT (user_id) DO UPDATE SET plan_id=$2, status='created', razorpay_subscription_id=$3,
         razorpay_plan_id=$4, cancel_at_cycle_end=FALSE, current_period_end=NULL, updated_at=now()`,
      [auth.userId, planId, sub.id, rzpPlan],
    )
    // key_id is the PUBLIC checkout key by design; the secret never leaves the server.
    return NextResponse.json({ subscriptionId: sub.id, keyId: process.env.RAZORPAY_KEY_ID })
  } catch (e) {
    const status = e instanceof RazorpayError ? e.status : 500
    console.error("[billing] subscribe failed:", (e as Error)?.message)
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: status === 503 ? 503 : 502 })
  }
}

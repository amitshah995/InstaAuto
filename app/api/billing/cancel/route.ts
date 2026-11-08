/**
 * POST /api/billing/cancel
 * Self-serve cancellation at the END of the current paid cycle (no refund logic here; see /refund-policy).
 * Who calls it: the Cancel button on app/dashboard/billing/page.tsx.
 */
import { type NextRequest, NextResponse } from "next/server"
import { authorizeUser } from "@/lib/auth"
import { rawQuery } from "@/lib/supabase-server"
import { effectivePlanId } from "@/lib/billing/plans"
import { RazorpayError, cancelSubscriptionAtCycleEnd } from "@/lib/billing/razorpay"
import { getSubscription } from "@/lib/billing/usage"

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const auth = authorizeUser(request, body?.userId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const sub = await getSubscription(auth.userId)
  if (!sub?.razorpay_subscription_id || effectivePlanId(sub) === "free") {
    return NextResponse.json({ error: "There is no active plan to cancel" }, { status: 400 })
  }
  if (sub.cancel_at_cycle_end) return NextResponse.json({ ok: true, alreadyScheduled: true })

  try {
    await cancelSubscriptionAtCycleEnd(sub.razorpay_subscription_id)
    await rawQuery(`UPDATE subscriptions SET cancel_at_cycle_end=TRUE, updated_at=now() WHERE user_id=$1`, [auth.userId])
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[billing] cancel failed:", (e as Error)?.message)
    const status = e instanceof RazorpayError && e.status === 503 ? 503 : 502
    return NextResponse.json({ error: "Could not cancel right now. Please try again or contact support." }, { status })
  }
}

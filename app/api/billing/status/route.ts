/**
 * GET /api/billing/status
 * Everything the billing page and usage banner need: configuration state, current plan,
 * subscription, usage meters, and recent invoices (links to Razorpay-hosted invoices).
 */
import { type NextRequest, NextResponse } from "next/server"
import { authorizeUser } from "@/lib/auth"
import { PLANS, PLAN_ORDER, billingEnabled, razorpayConfigured } from "@/lib/billing/plans"
import { listInvoices } from "@/lib/billing/razorpay"
import { getSubscription, getUsageSummary } from "@/lib/billing/usage"

export async function GET(request: NextRequest) {
  const auth = authorizeUser(request, request.nextUrl.searchParams.get("userId"))
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const usage = await getUsageSummary(auth.userId)
  const configured = razorpayConfigured()
  const enabled = billingEnabled()
  const sub = await getSubscription(auth.userId)

  let invoices: Array<{ id: string; amount: number; currency: string; status: string; url?: string; issuedAt?: number }> = []
  if (enabled && sub?.razorpay_subscription_id) {
    try {
      invoices = (await listInvoices(sub.razorpay_subscription_id)).map((i) => ({
        id: i.id, amount: i.amount, currency: i.currency, status: i.status, url: i.short_url, issuedAt: i.issued_at,
      }))
    } catch {
      // invoices are a convenience; the page still works without them
    }
  }

  return NextResponse.json({
    configured,
    enabled,
    plan: usage.plan,
    usage: { dms: usage.dms, ai: usage.ai, resets: usage.periodResets, enforced: usage.enforced },
    subscription: sub && { status: sub.status, cancelAtCycleEnd: sub.cancel_at_cycle_end, currentPeriodEnd: sub.current_period_end },
    plans: PLAN_ORDER.map((id) => PLANS[id]),
    invoices,
  })
}

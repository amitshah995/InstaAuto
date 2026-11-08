/**
 * POST /api/billing/verify  { razorpay_payment_id, razorpay_subscription_id, razorpay_signature }
 * Checks the signature Razorpay Checkout returns to the browser, so the plan can switch on
 * immediately instead of waiting for the webhook. The webhook remains the source of truth.
 * Who calls it: app/dashboard/billing/page.tsx after Checkout succeeds.
 */
import { type NextRequest, NextResponse } from "next/server"
import { authorizeUser } from "@/lib/auth"
import { rawQuery } from "@/lib/supabase-server"
import { verifyPaymentSignature } from "@/lib/billing/razorpay-verify"
import { getSubscription } from "@/lib/billing/usage"

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const auth = authorizeUser(request, body?.userId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { razorpay_payment_id: paymentId, razorpay_subscription_id: subId, razorpay_signature: sig } = body || {}
  if (typeof paymentId !== "string" || typeof subId !== "string" || typeof sig !== "string") {
    return NextResponse.json({ error: "Missing payment details" }, { status: 400 })
  }

  // The subscription id must be the one WE created for THIS account (stops claiming someone else's payment).
  const mine = await getSubscription(auth.userId)
  if (!mine || mine.razorpay_subscription_id !== subId) {
    return NextResponse.json({ error: "Subscription not found for this account" }, { status: 404 })
  }
  if (!verifyPaymentSignature(paymentId, subId, sig, process.env.RAZORPAY_KEY_SECRET)) {
    return NextResponse.json({ error: "Payment signature could not be verified" }, { status: 400 })
  }
  // Only move forward from 'created'; never downgrade an already-active row the webhook updated first.
  await rawQuery(`UPDATE subscriptions SET status='authenticated', updated_at=now() WHERE user_id=$1 AND status='created'`, [auth.userId])
  return NextResponse.json({ ok: true })
}

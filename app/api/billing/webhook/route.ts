/**
 * POST /api/billing/webhook  (Razorpay -> Celra)
 * Source of truth for subscription state. Verifies the HMAC-SHA256 signature over the RAW body
 * (constant-time), applies each event once (idempotent by x-razorpay-event-id), then updates
 * the subscriptions row.
 * Setup: in the Razorpay dashboard add this URL, select the subscription.* events, and put the
 * same secret in RAZORPAY_WEBHOOK_SECRET.
 */
import crypto from "crypto"
import { type NextRequest, NextResponse } from "next/server"
import { rawQuery } from "@/lib/supabase-server"
import { verifyWebhookSignature } from "@/lib/billing/razorpay-verify"
import { planForRazorpayPlan, statusForEvent } from "@/lib/billing/subscription-events"

export async function POST(request: NextRequest) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: "Billing not configured" }, { status: 503 })

  // Raw text first: the signature covers the exact bytes, not re-serialised JSON.
  const raw = await request.text()
  if (!verifyWebhookSignature(raw, request.headers.get("x-razorpay-signature"), secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  let evt: any
  try {
    evt = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: "Malformed JSON" }, { status: 400 })
  }

  const eventType: string = evt?.event || "unknown"
  const status = statusForEvent(eventType)
  const entity = evt?.payload?.subscription?.entity
  // Razorpay sends a unique event id header; fall back to a body hash so retries still dedupe.
  const eventId = request.headers.get("x-razorpay-event-id") || crypto.createHash("sha256").update(raw).digest("hex")

  if (!status || !entity?.id) return NextResponse.json({ ok: true, ignored: true }) // events we do not act on

  try {
    // Idempotency: first writer wins. A duplicate delivery inserts nothing and is acknowledged.
    const claimed = await rawQuery(
      `INSERT INTO billing_events (event_id, event_type) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING event_id`,
      [eventId, eventType],
    )
    if (claimed.length === 0) return NextResponse.json({ ok: true, duplicate: true })

    try {
      const notes = entity.notes && !Array.isArray(entity.notes) ? entity.notes : {}
      const periodEnd = typeof entity.current_end === "number" ? new Date(entity.current_end * 1000).toISOString() : null
      const updated = await rawQuery<{ user_id: string }>(
        `UPDATE subscriptions SET status=$2, current_period_end=COALESCE($3, current_period_end), updated_at=now()
          WHERE razorpay_subscription_id=$1 RETURNING user_id::text AS user_id`,
        [entity.id, status, periodEnd],
      )
      let userId = updated[0]?.user_id
      if (!userId && /^\d+$/.test(String(notes.user_id || ""))) {
        // Row missing (e.g. created outside our route): rebuild it from the notes we attached at creation.
        const plan = planForRazorpayPlan(entity.plan_id) ?? "free"
        userId = String(notes.user_id)
        // QA fix: DO NOTHING on conflict. The user already has a row for a DIFFERENT (newer) subscription, so this is a
        // stale event for a superseded one (e.g. the old subscription's "cancelled" arriving after a re-subscribe).
        // The old DO UPDATE let it overwrite the live paid subscription and silently downgrade a paying customer.
        await rawQuery(
          `INSERT INTO subscriptions (user_id, plan_id, status, razorpay_subscription_id, razorpay_plan_id, current_period_end)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (user_id) DO NOTHING`,
          [userId, plan, status, entity.id, entity.plan_id ?? null, periodEnd],
        )
      }
      if (userId) await rawQuery(`UPDATE billing_events SET user_id=$2 WHERE event_id=$1`, [eventId, userId])
    } catch (e) {
      // Processing failed: release the idempotency claim so Razorpay's retry can apply the event.
      await rawQuery(`DELETE FROM billing_events WHERE event_id=$1`, [eventId]).catch(() => {})
      throw e
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[billing] webhook processing failed:", (e as Error)?.message)
    return NextResponse.json({ error: "Processing failed" }, { status: 500 })
  }
}

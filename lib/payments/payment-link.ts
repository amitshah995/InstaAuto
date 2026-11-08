/**
 * Creates a Razorpay Payment Link for a DM "pay" button.
 *
 * Who calls this: lib/messaging/send-steps.ts when a card button has type "pay".
 * Returns null (never throws) when the feature is off, env is missing, the amount is invalid or
 * Razorpay errors, so the caller can skip the step cleanly instead of breaking the webhook.
 * API: https://razorpay.com/docs/api/payments/payment-links/create-standard/
 */
import { rp } from "@/lib/billing/razorpay"
import { buildPaymentLinkRequest, paymentLinksEnabled } from "./payment-link-request.ts"

export async function createPaymentLink(input: {
  amountInr: unknown
  description?: string
  userId: string | number
  psid?: string
}): Promise<{ url: string } | null> {
  if (!paymentLinksEnabled()) return null
  const body = buildPaymentLinkRequest(input)
  if (!body) return null
  try {
    const r = await rp<{ short_url?: string }>("POST", "/payment_links", body)
    return r.short_url ? { url: r.short_url } : null
  } catch (e) {
    console.error("[payments] payment link failed:", (e as Error)?.message)
    return null
  }
}

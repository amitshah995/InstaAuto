/**
 * Razorpay signature verification (pure HMAC maths, no network).
 *
 * Who calls this: app/api/billing/verify (checkout handler) and app/api/billing/webhook.
 * Why: a payment is trusted only if Razorpay's HMAC-SHA256 signature matches, compared in
 * constant time. Formulas from the Razorpay docs:
 *  - Subscription checkout: HMAC_SHA256(razorpay_payment_id + "|" + subscription_id, key_secret)
 *  - Webhook: HMAC_SHA256(raw request body, webhook_secret) in the X-Razorpay-Signature header
 * https://razorpay.com/docs/payments/subscriptions/integration-guide/ and
 * https://razorpay.com/docs/webhooks/validate-test/
 */
import crypto from "crypto"

function hmacHex(data: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(data).digest("hex")
}

/** Constant-time compare of two hex strings; false on any length mismatch or missing input. */
function safeHexEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8")
  const bb = Buffer.from(b, "utf8")
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb)
}

export function verifyPaymentSignature(
  paymentId: string,
  subscriptionId: string,
  signature: string,
  keySecret: string | undefined,
): boolean {
  if (!keySecret || !paymentId || !subscriptionId || !signature) return false
  return safeHexEqual(hmacHex(`${paymentId}|${subscriptionId}`, keySecret), signature)
}

/** rawBody MUST be the exact bytes received; re-serialising parsed JSON would break the signature. */
export function verifyWebhookSignature(rawBody: string, signature: string | null, webhookSecret: string | undefined): boolean {
  if (!webhookSecret || !signature) return false
  return safeHexEqual(hmacHex(rawBody, webhookSecret), signature)
}

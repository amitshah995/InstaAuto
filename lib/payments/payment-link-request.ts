/**
 * Pure helpers for Razorpay Payment Links sent inside DMs ("pay" button type).
 *
 * Who calls this: lib/payments/payment-link.ts (builds the API request) and the DM send path.
 * Why separate: amount validation and the on/off gate decide whether we ever ask Razorpay to
 * create a link, so they are unit-tested without network.
 * Gate: payment links need Razorpay keys AND PAYMENT_LINKS_ENABLED=1. They are off by default
 * because links created with the platform's keys settle into the PLATFORM's Razorpay account,
 * which needs a payout/marketplace decision before real use (see the engineer report).
 */

export const MIN_AMOUNT_INR = 1
export const MAX_AMOUNT_INR = 500_000

export function paymentLinksEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.PAYMENT_LINKS_ENABLED === "1" && !!env.RAZORPAY_KEY_ID && !!env.RAZORPAY_KEY_SECRET
}

/** Whole rupees (decimals allowed, max 2) -> integer paise, or null when invalid. */
export function toPaise(amountInr: unknown): number | null {
  const n = typeof amountInr === "string" ? Number(amountInr.trim()) : amountInr
  if (typeof n !== "number" || !Number.isFinite(n)) return null
  if (n < MIN_AMOUNT_INR || n > MAX_AMOUNT_INR) return null
  const paise = Math.round(n * 100)
  return Math.abs(paise - n * 100) < 1e-6 ? paise : null // reject 10.123
}

export interface PaymentLinkRequest {
  amount: number
  currency: "INR"
  accept_partial: false
  description: string
  reference_id: string
  expire_by: number
  notify: { sms: false; email: false }
  reminder_enable: false
  notes: Record<string, string>
}

/** Razorpay allows reference_id up to 40 chars and description up to 2048; links expire after 7 days. */
export function buildPaymentLinkRequest(input: {
  amountInr: unknown
  description?: string
  userId: string | number
  psid?: string
  nowMs?: number
  nonce?: string
}): PaymentLinkRequest | null {
  const amount = toPaise(input.amountInr)
  if (amount === null) return null
  const now = input.nowMs ?? Date.now()
  const nonce = input.nonce ?? Math.random().toString(36).slice(2, 8)
  return {
    amount,
    currency: "INR",
    accept_partial: false,
    description: (input.description || "Payment").replace(/\s+/g, " ").trim().slice(0, 200) || "Payment",
    reference_id: `cl_${input.userId}_${now.toString(36)}_${nonce}`.slice(0, 40),
    expire_by: Math.floor(now / 1000) + 7 * 24 * 3600,
    notify: { sms: false, email: false },
    reminder_enable: false,
    notes: { user_id: String(input.userId), ...(input.psid ? { igsid: input.psid } : {}) },
  }
}

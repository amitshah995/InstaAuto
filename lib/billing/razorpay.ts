/**
 * Minimal Razorpay REST client using plain fetch (no SDK dependency).
 *
 * Who calls this: the /api/billing/* routes and lib/payments/payment-link.ts.
 * Why: keeps secrets in env vars only (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET), keeps the
 * dependency list unchanged, and returns clear errors instead of throwing when Razorpay is
 * missing or unhappy. Secrets and Authorization headers are never logged.
 * API reference: https://razorpay.com/docs/api/
 */

const BASE = "https://api.razorpay.com/v1"

export class RazorpayError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

export function razorpayKeysPresent(): boolean {
  return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
}

export async function rp<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const id = process.env.RAZORPAY_KEY_ID
  const secret = process.env.RAZORPAY_KEY_SECRET
  if (!id || !secret) throw new RazorpayError("Billing is not configured", 503)
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    // A hung payment provider must not hang our function.
    signal: AbortSignal.timeout(15_000),
  })
  const json: any = await res.json().catch(() => ({}))
  if (!res.ok) {
    // Razorpay error texts are safe to surface (no secrets), but never include request headers.
    throw new RazorpayError(json?.error?.description || `Razorpay error ${res.status}`, res.status)
  }
  return json as T
}

export interface RzpSubscription {
  id: string
  plan_id: string
  status: string
  current_end?: number | null
  notes?: Record<string, string> | unknown[]
}

export const createSubscription = (planId: string, notes: Record<string, string>) =>
  rp<RzpSubscription>("POST", "/subscriptions", {
    plan_id: planId,
    total_count: 120, // 10 years of monthly cycles; the customer can cancel any time
    quantity: 1,
    customer_notify: 1,
    notes,
  })

/** cancel_at_cycle_end=1: the customer keeps what they paid for until the period ends. */
export const cancelSubscriptionAtCycleEnd = (subscriptionId: string) =>
  rp<RzpSubscription>("POST", `/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, { cancel_at_cycle_end: 1 })

export interface RzpInvoice {
  id: string
  amount: number
  currency: string
  status: string
  short_url?: string
  issued_at?: number
}

export async function listInvoices(subscriptionId: string): Promise<RzpInvoice[]> {
  const r = await rp<{ items?: RzpInvoice[] }>("GET", `/invoices?subscription_id=${encodeURIComponent(subscriptionId)}&count=12`)
  return r.items ?? []
}

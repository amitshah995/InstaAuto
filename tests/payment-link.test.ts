// Unit tests for the Razorpay payment-link request builder and its on/off gate.
import test from "node:test"
import assert from "node:assert/strict"
import { buildPaymentLinkRequest, paymentLinksEnabled, toPaise } from "../lib/payments/payment-link-request.ts"

test("payment links are off unless explicitly enabled AND keys exist", () => {
  assert.equal(paymentLinksEnabled({}), false)
  assert.equal(paymentLinksEnabled({ PAYMENT_LINKS_ENABLED: "1" }), false)
  assert.equal(paymentLinksEnabled({ RAZORPAY_KEY_ID: "k", RAZORPAY_KEY_SECRET: "s" }), false)
  assert.equal(paymentLinksEnabled({ PAYMENT_LINKS_ENABLED: "1", RAZORPAY_KEY_ID: "k", RAZORPAY_KEY_SECRET: "s" }), true)
})

test("toPaise validates rupee amounts", () => {
  assert.equal(toPaise(499), 49900)
  assert.equal(toPaise("499.50"), 49950)
  assert.equal(toPaise(1), 100)
  assert.equal(toPaise(0), null)
  assert.equal(toPaise(0.5), null)
  assert.equal(toPaise(-5), null)
  assert.equal(toPaise(10.123), null)
  assert.equal(toPaise(500_001), null)
  assert.equal(toPaise("abc"), null)
  assert.equal(toPaise(NaN), null)
  assert.equal(toPaise(undefined), null)
})

test("buildPaymentLinkRequest shape and limits", () => {
  const r = buildPaymentLinkRequest({ amountInr: 499, description: "  My   course  ", userId: 42, psid: "17841", nowMs: 1_700_000_000_000, nonce: "abc123" })!
  assert.equal(r.amount, 49900)
  assert.equal(r.currency, "INR")
  assert.equal(r.description, "My course")
  assert.ok(r.reference_id.length <= 40)
  assert.equal(r.expire_by, 1_700_000_000 + 7 * 86400)
  assert.deepEqual(r.notify, { sms: false, email: false })
  assert.deepEqual(r.notes, { user_id: "42", igsid: "17841" })
  assert.equal(buildPaymentLinkRequest({ amountInr: 0, userId: 1 }), null)
  assert.equal(buildPaymentLinkRequest({ amountInr: 10, userId: 1, description: "x".repeat(500) })!.description.length, 200)
  assert.equal(buildPaymentLinkRequest({ amountInr: 10, userId: "9".repeat(60) })!.reference_id.length, 40)
})

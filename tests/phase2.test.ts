// Unit tests for Phase 2 pure logic: plan resolution, quota math, billing flags, Razorpay HMAC checks, event mapping.
import test from "node:test"
import assert from "node:assert/strict"
import crypto from "node:crypto"
import { PLANS, billingEnabled, effectivePlanId, evaluateQuota, formatInr, limitMessage, periodKeys, razorpayConfigured, razorpayPlanIdFor } from "../lib/billing/plans.ts"
import { verifyPaymentSignature, verifyWebhookSignature } from "../lib/billing/razorpay-verify.ts"
import { planForRazorpayPlan, statusForEvent } from "../lib/billing/subscription-events.ts"

test("plans: flat INR prices, no per-contact fields, sane ordering of limits", () => {
  assert.equal(PLANS.free.priceInrMonthly, 0)
  assert.ok(PLANS.starter.dmsPerMonth > PLANS.free.dmsPerMonth)
  assert.ok(PLANS.pro.dmsPerMonth > PLANS.starter.dmsPerMonth)
  assert.ok(PLANS.pro.aiRunsPerDay > PLANS.starter.aiRunsPerDay)
  for (const p of Object.values(PLANS)) assert.equal("perContact" in p, false)
  assert.equal(formatInr(1499), "₹1,499")
})

test("evaluateQuota: ok, warn at 80%, limit at 100%, never negative", () => {
  assert.deepEqual(evaluateQuota(0, 500), { used: 0, limit: 500, remaining: 500, percent: 0, state: "ok" })
  assert.equal(evaluateQuota(399, 500).state, "ok")
  assert.equal(evaluateQuota(400, 500).state, "warn")
  assert.equal(evaluateQuota(500, 500).state, "limit")
  assert.equal(evaluateQuota(900, 500).remaining, 0)
  assert.equal(evaluateQuota(900, 500).percent, 100)
  assert.equal(evaluateQuota(-3, 500).used, 0)
})

test("periodKeys are UTC month and day buckets", () => {
  assert.deepEqual(periodKeys(new Date("2026-12-31T23:59:59Z")), { month: "2026-12", day: "2026-12-31" })
  assert.deepEqual(periodKeys(new Date("2027-01-01T00:00:00Z")), { month: "2027-01", day: "2027-01-01" })
})

test("effectivePlanId: who is paid right now", () => {
  const future = new Date(Date.now() + 86400000).toISOString()
  const past = new Date(Date.now() - 86400000).toISOString()
  assert.equal(effectivePlanId(null), "free")
  assert.equal(effectivePlanId({ plan_id: "starter", status: "created" }), "free") // never paid
  assert.equal(effectivePlanId({ plan_id: "starter", status: "active" }), "starter")
  assert.equal(effectivePlanId({ plan_id: "pro", status: "pending" }), "pro") // Razorpay still retrying the charge
  assert.equal(effectivePlanId({ plan_id: "pro", status: "halted" }), "free")
  assert.equal(effectivePlanId({ plan_id: "pro", status: "cancelled", current_period_end: future }), "pro") // paid until period end
  assert.equal(effectivePlanId({ plan_id: "pro", status: "cancelled", current_period_end: past }), "free")
  assert.equal(effectivePlanId({ plan_id: "pro", status: "cancelled" }), "free")
  assert.equal(effectivePlanId({ plan_id: "bogus", status: "active" }), "free")
})

test("billing flags degrade to free beta when env is missing", () => {
  assert.equal(razorpayConfigured({}), false)
  assert.equal(billingEnabled({ BILLING_ENABLED: "1" }), false) // flag alone is not enough
  const env = { RAZORPAY_KEY_ID: "k", RAZORPAY_KEY_SECRET: "s", RAZORPAY_WEBHOOK_SECRET: "w", RAZORPAY_PLAN_ID_STARTER: "plan_a" }
  assert.equal(razorpayConfigured(env), true)
  assert.equal(billingEnabled(env), false) // configured but not switched on
  assert.equal(billingEnabled({ ...env, BILLING_ENABLED: "1" }), true)
  assert.equal(razorpayPlanIdFor("starter", env), "plan_a")
  assert.equal(razorpayPlanIdFor("pro", env), null)
  assert.equal(razorpayPlanIdFor("free", env), null)
})

test("limit messages are friendly and name the plan", () => {
  assert.match(limitMessage("dm", PLANS.free), /500 DMs.*Free plan/)
  assert.match(limitMessage("ai", PLANS.starter), /20 AI runs.*Starter/)
})

test("Razorpay payment signature: valid, tampered, missing secret", () => {
  const secret = "key_secret_123"
  const good = crypto.createHmac("sha256", secret).update("pay_1|sub_1").digest("hex")
  assert.equal(verifyPaymentSignature("pay_1", "sub_1", good, secret), true)
  assert.equal(verifyPaymentSignature("pay_1", "sub_2", good, secret), false)
  assert.equal(verifyPaymentSignature("pay_2", "sub_1", good, secret), false)
  assert.equal(verifyPaymentSignature("pay_1", "sub_1", good, undefined), false)
  assert.equal(verifyPaymentSignature("pay_1", "sub_1", "", secret), false)
  assert.equal(verifyPaymentSignature("pay_1", "sub_1", good.slice(0, 10), secret), false)
})

test("Razorpay webhook signature covers the exact raw body", () => {
  const secret = "whsec"
  const body = '{"event":"subscription.activated"}'
  const sig = crypto.createHmac("sha256", secret).update(body).digest("hex")
  assert.equal(verifyWebhookSignature(body, sig, secret), true)
  assert.equal(verifyWebhookSignature(body + " ", sig, secret), false)
  assert.equal(verifyWebhookSignature(body, null, secret), false)
  assert.equal(verifyWebhookSignature(body, sig, undefined), false)
})

test("subscription event mapping", () => {
  assert.equal(statusForEvent("subscription.activated"), "active")
  assert.equal(statusForEvent("subscription.charged"), "active")
  assert.equal(statusForEvent("subscription.halted"), "halted")
  assert.equal(statusForEvent("subscription.cancelled"), "cancelled")
  assert.equal(statusForEvent("payment.captured"), null)
  const env = { RAZORPAY_PLAN_ID_STARTER: "plan_s", RAZORPAY_PLAN_ID_PRO: "plan_p" }
  assert.equal(planForRazorpayPlan("plan_p", env), "pro")
  assert.equal(planForRazorpayPlan("plan_x", env), null)
  assert.equal(planForRazorpayPlan(undefined, env), null)
})

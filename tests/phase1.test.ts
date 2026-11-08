// Unit tests for Phase 1 pure logic: auth defaults, service auth, retry classification and backoff.
// Run with: npm test  (node:test, no extra dependencies)
import test from "node:test"
import assert from "node:assert/strict"
import { resolveAuthFlags } from "../lib/security/auth-flags.ts"
import { isServiceAuthorized, safeEqual } from "../lib/security/service-auth.ts"
import { backoffMs, classifyFailure, storedRetryDelayMinutes, withRetry } from "../lib/messaging/retry.ts"
import { retentionDays } from "../lib/retention-days.ts"

const hdr = (h: Record<string, string>) => ({ get: (n: string) => h[n.toLowerCase()] ?? null })

test("auth defaults: dev stays open, prod with secret is safe, explicit values win", () => {
  assert.deepEqual(resolveAuthFlags({ NODE_ENV: "development" }), { acceptLegacy: true, enforce: false })
  assert.deepEqual(resolveAuthFlags({ NODE_ENV: "production" }), { acceptLegacy: true, enforce: false }) // no secret: cannot enforce
  assert.deepEqual(resolveAuthFlags({ NODE_ENV: "production", SESSION_SECRET: "x".repeat(40) }), { acceptLegacy: false, enforce: true })
  assert.deepEqual(
    resolveAuthFlags({ NODE_ENV: "production", SESSION_SECRET: "x".repeat(40), AUTH_ENFORCE: "0", SESSION_ACCEPT_LEGACY: "1" }),
    { acceptLegacy: true, enforce: false },
  )
  assert.equal(resolveAuthFlags({ NODE_ENV: "development", AUTH_ENFORCE: "1" }).enforce, true)
})

test("service auth: bearer CRON_SECRET, legacy x-api-secret, fail closed", () => {
  const env = { CRON_SECRET: "cron-secret", API_SECRET_KEY: "api-secret" }
  assert.equal(isServiceAuthorized(hdr({ authorization: "Bearer cron-secret" }), env), true)
  assert.equal(isServiceAuthorized(hdr({ authorization: "Bearer api-secret" }), env), true)
  assert.equal(isServiceAuthorized(hdr({ "x-api-secret": "api-secret" }), env), true)
  assert.equal(isServiceAuthorized(hdr({ authorization: "Bearer nope" }), env), false)
  assert.equal(isServiceAuthorized(hdr({}), env), false)
  // x-api-secret must not be accepted for the cron secret
  assert.equal(isServiceAuthorized(hdr({ "x-api-secret": "cron-secret" }), env), false)
  // unset secrets never match, even with an empty header
  assert.equal(isServiceAuthorized(hdr({ authorization: "Bearer " }), {}), false)
  assert.equal(isServiceAuthorized(hdr({ "x-api-secret": "" }), {}), false)
  assert.equal(safeEqual("a", "a"), true)
  assert.equal(safeEqual("a", "ab"), false)
})

test("classifyFailure: transient vs permanent", () => {
  assert.deepEqual(classifyFailure({ networkError: true }), { kind: "transient", reason: "network" })
  assert.equal(classifyFailure({ status: 429 }).kind, "transient")
  assert.equal(classifyFailure({ status: 503, error: { message: "x" } }).kind, "transient")
  assert.equal(classifyFailure({ status: 400, error: { code: 4 } }).reason, "rate_limit")
  assert.equal(classifyFailure({ status: 400, error: { code: 2 } }).reason, "server")
  assert.equal(classifyFailure({ status: 400, error: { code: 99, is_transient: true } }).kind, "transient")
  // permanent
  assert.equal(classifyFailure({ status: 400, error: { code: 190 } }).reason, "token")
  assert.equal(classifyFailure({ status: 400, error: { code: 10, error_subcode: 2534022 } }).reason, "window")
  assert.equal(classifyFailure({ status: 400, error: { code: 100 } }).kind, "permanent")
  assert.equal(classifyFailure({ status: 400, error: { code: 368 } }).reason, "spam")
  assert.equal(classifyFailure({ status: 400, error: { code: 551 } }).reason, "unavailable")
  assert.equal(classifyFailure({ status: 400, error: { code: 12345 } }).kind, "permanent") // unknown = safe
  // a token error wrapped in a 500 must still be permanent
  assert.equal(classifyFailure({ status: 500, error: { code: 190 } }).kind, "permanent")
})

test("backoffMs grows, is capped and jittered within 50-100%", () => {
  assert.equal(backoffMs(1, { rand: () => 1 }), 400)
  assert.equal(backoffMs(2, { rand: () => 1 }), 800)
  assert.equal(backoffMs(3, { rand: () => 1 }), 1600)
  assert.equal(backoffMs(10, { rand: () => 1 }), 3000)
  assert.equal(backoffMs(1, { rand: () => 0 }), 200)
  assert.equal(storedRetryDelayMinutes(1), 1)
  assert.equal(storedRetryDelayMinutes(5), 180)
  assert.equal(storedRetryDelayMinutes(6), null)
})

test("withRetry retries transient errors only", async () => {
  const sleeps: number[] = []
  const sleep = async (ms: number) => void sleeps.push(ms)

  let n = 0
  const ok = await withRetry(async () => (++n < 3 ? { ok: false, status: 503 } : { ok: true, value: "m1" }), { sleep, rand: () => 1 })
  assert.equal(ok.outcome.ok, true)
  assert.equal(ok.attempts, 3)
  assert.deepEqual(sleeps, [400, 800])

  let p = 0
  const perm = await withRetry(async () => (p++, { ok: false, status: 400, error: { code: 190 } }), { sleep })
  assert.equal(perm.attempts, 1)
  assert.equal(p, 1)
  assert.equal(perm.classification?.kind, "permanent")

  let t = 0
  const exhausted = await withRetry(async () => (t++, { ok: false, networkError: true }), { sleep, maxAttempts: 3 })
  assert.equal(t, 3)
  assert.equal(exhausted.outcome.ok, false)

  // a long Retry-After is left to the stored retry instead of holding the webhook open
  let r = 0
  const long = await withRetry(async () => (r++, { ok: false, status: 429, retryAfterSec: 60 }), { sleep })
  assert.equal(r, 1)
  assert.equal(long.classification?.kind, "transient")
})

test("retentionDays defaults to 30 and rejects bad values", () => {
  assert.equal(retentionDays(undefined), 30)
  assert.equal(retentionDays("7"), 7)
  assert.equal(retentionDays("0"), 30)
  assert.equal(retentionDays("abc"), 30)
  assert.equal(retentionDays("-5"), 30)
})

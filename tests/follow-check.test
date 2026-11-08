// Unit tests for follow-status parsing and the fall-back-to-honour-system behaviour.
import test from "node:test"
import assert from "node:assert/strict"
import { checkFollowStatus, parseFollowResponse } from "../lib/messaging/follow-check.ts"

test("parseFollowResponse only trusts explicit booleans", () => {
  assert.equal(parseFollowResponse({ is_user_follow_business: true }), "following")
  assert.equal(parseFollowResponse({ is_user_follow_business: false }), "not_following")
  assert.equal(parseFollowResponse({}), "unknown")
  assert.equal(parseFollowResponse({ is_user_follow_business: "true" }), "unknown")
  assert.equal(parseFollowResponse({ error: { code: 190 }, is_user_follow_business: true }), "unknown")
  assert.equal(parseFollowResponse(null), "unknown")
})

test("checkFollowStatus: ok, API error and network failure", async () => {
  const ok = (body: unknown) => (async () => ({ json: async () => body })) as unknown as typeof fetch
  assert.equal(await checkFollowStatus("t", "123", ok({ is_user_follow_business: true })), "following")
  assert.equal(await checkFollowStatus("t", "123", ok({ is_user_follow_business: false })), "not_following")
  assert.equal(await checkFollowStatus("t", "123", ok({ error: { message: "no consent" } })), "unknown")
  const boom = (async () => { throw new Error("net") }) as unknown as typeof fetch
  assert.equal(await checkFollowStatus("t", "123", boom), "unknown")
  let url = ""
  const spy = (async (u: string) => { url = u; return { json: async () => ({}) } }) as unknown as typeof fetch
  await checkFollowStatus("tok en", "9/9", spy)
  assert.match(url, /graph\.instagram\.com\/v24\.0\/9%2F9\?fields=is_user_follow_business&access_token=tok%20en$/)
})

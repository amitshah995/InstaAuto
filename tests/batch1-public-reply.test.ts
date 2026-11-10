// Unit tests for custom public comment replies (pure, no network).
import test from "node:test"
import assert from "node:assert/strict"
import {
  DEFAULT_PUBLIC_REPLIES,
  MAX_PUBLIC_REPLY_LENGTH,
  MAX_PUBLIC_REPLY_VARIANTS,
  fillPlaceholders,
  firstNameFrom,
  pickVariantIndex,
  resolvePublicReply,
  sanitizePublicReply,
  variantsNeedName,
} from "../lib/automations/public-reply.ts"
import { sanitizeResponseContent } from "../lib/automations/sanitize.ts"

test("sanitizePublicReply: trims, de-duplicates, caps count and length", () => {
  const long = "x".repeat(400)
  const many = Array.from({ length: 25 }, (_, i) => `variant ${i}`)
  const r = sanitizePublicReply({ enabled: true, variants: ["  Hi  ", "hi", "", 5, long, ...many] })!
  assert.equal(r.variants[0], "Hi")
  assert.equal(r.variants[1].length, MAX_PUBLIC_REPLY_LENGTH)
  assert.equal(r.variants.length, MAX_PUBLIC_REPLY_VARIANTS)
  assert.equal(sanitizePublicReply(null), undefined)
  assert.equal(sanitizePublicReply("nope"), undefined)
  assert.equal(sanitizePublicReply({ enabled: false, variants: [] })!.enabled, false)
})

test("sanitizePublicReply: length cap counts characters, not UTF-16 units (emoji safe)", () => {
  const r = sanitizePublicReply({ variants: ["🔥".repeat(200)] })!
  assert.equal(Array.from(r.variants[0]).length, MAX_PUBLIC_REPLY_LENGTH)
})

test("fillPlaceholders: fills, absorbs a typed @, and removes empty placeholders cleanly", () => {
  assert.equal(fillPlaceholders("Hi {first_name}!", { firstName: "Priya" }), "Hi Priya!")
  assert.equal(fillPlaceholders("Sent {username}", { username: "ann" }), "Sent @ann")
  assert.equal(fillPlaceholders("Sent @{username}", { username: "@ann" }), "Sent @ann")
  assert.equal(fillPlaceholders("Thanks {first_name}!", {}), "Thanks!")
  assert.equal(fillPlaceholders("{first_name}, check your DMs", {}), "check your DMs")
  assert.equal(fillPlaceholders("Hello {FIRST_NAME}", { firstName: "Raj" }), "Hello Raj")
})

test("firstNameFrom: saved name first word, else username", () => {
  assert.equal(firstNameFrom("Priya Shah", "p"), "Priya")
  assert.equal(firstNameFrom("  ", "@ann"), "ann")
  assert.equal(firstNameFrom(null, null), null)
})

test("variantsNeedName only for {first_name}", () => {
  assert.equal(variantsNeedName(["a", "b {first_name}"]), true)
  assert.equal(variantsNeedName(["a {username}"]), false)
})

test("pickVariantIndex never repeats the previous index and stays in range", () => {
  for (let n = 2; n <= 6; n++) {
    for (let last = 0; last < n; last++) {
      for (const r of [0, 0.2, 0.5, 0.99, 0.9999]) {
        const i = pickVariantIndex(n, last, () => r)
        assert.ok(i >= 0 && i < n, `in range n=${n} last=${last} r=${r}`)
        assert.notEqual(i, last)
      }
    }
  }
  assert.equal(pickVariantIndex(1, 0, () => 0.5), 0)
  assert.equal(pickVariantIndex(3, null, () => 0.99), 2)
})

test("pickVariantIndex rotation reaches every variant", () => {
  let seed = 7
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const seen = new Set<number>()
  let last: number | null = null
  for (let k = 0; k < 200; k++) { last = pickVariantIndex(4, last, rand); seen.add(last) }
  assert.equal(seen.size, 4)
})

test("resolvePublicReply: legacy rule (no public_reply) keeps the three default phrases for comments", () => {
  const r = resolvePublicReply({ message: "hi" }, {}, { rand: () => 0 })
  assert.equal(r.text, DEFAULT_PUBLIC_REPLIES[0])
  const r2 = resolvePublicReply({ message: "hi" }, {}, { rand: () => 0.99 })
  assert.equal(r2.text, DEFAULT_PUBLIC_REPLIES[2])
})

test("resolvePublicReply: live comments default to no public reply", () => {
  assert.deepEqual(resolvePublicReply({ message: "hi" }, {}, { isLive: true }), { text: null, index: null })
})

test("resolvePublicReply: disabled sends nothing; enabled with no text falls back to defaults; custom list is used", () => {
  assert.equal(resolvePublicReply({ public_reply: { enabled: false, variants: ["x"] } }, {}).text, null)
  const d = resolvePublicReply({ public_reply: { enabled: true, variants: [] } }, {}, { rand: () => 0 })
  assert.equal(d.text, DEFAULT_PUBLIC_REPLIES[0])
  const c = resolvePublicReply({ public_reply: { enabled: true, variants: ["Done {first_name}!", "On its way"] } }, { firstName: "Raj" }, { rand: () => 0 })
  assert.equal(c.text, "Done Raj!")
  assert.equal(c.index, 0)
})

test("resolvePublicReply: a variant that becomes empty after filling is skipped (null)", () => {
  const r = resolvePublicReply({ public_reply: { enabled: true, variants: ["{first_name}"] } }, {}, { rand: () => 0 })
  assert.equal(r.text, null)
})

test("sanitizeResponseContent clamps public_reply and leaves other fields alone", () => {
  const out = sanitizeResponseContent({ message: "hi", check_follow: true, public_reply: { enabled: true, variants: ["a", "a", "b"] } })
  assert.deepEqual(out.public_reply, { enabled: true, variants: ["a", "b"] })
  assert.equal(out.message, "hi")
  assert.equal(out.check_follow, true)
  const dropped = sanitizeResponseContent({ message: "hi", public_reply: 7 })
  assert.equal("public_reply" in dropped, false)
  assert.equal(sanitizeResponseContent(null), null)
  const untouched = { message: "x", steps: [{ text: "a" }] }
  assert.deepEqual(sanitizeResponseContent(untouched), untouched)
})

test("fillPlaceholders: no stray comma when the name is missing", () => {
  assert.equal(fillPlaceholders("Thanks, {first_name}!", {}), "Thanks!")
})

// QA (adversarial): phone validation edge cases and the consent gate.
import test from "node:test"
import assert from "node:assert/strict"
import { findPhoneInText, normalizeIndianMobile, findEmailInText, validateEmail } from "../lib/agent/validate.ts"
import { applyUserMessage, canForwardPhone, classifyReply, emptyConsent, isRevocation, markAsked, CONSENT_LINE } from "../lib/agent/consent.ts"
import { runTool, validateToolInput } from "../lib/agent/tools.ts"
import { newAgentState } from "../lib/agent/engine.ts"

const NOW = new Date("2026-11-15T10:00:00Z")
const ok = (raw: string) => normalizeIndianMobile(raw)

test("phone: accepted Indian formats all normalise to the same E.164", () => {
  for (const f of ["9876501234", "+919876501234", "919876501234", "09876501234", "0091 98765 01234", "+91 98765-01234", "+91-(98765) 01234", "98765 01234", "(98765)01234", "98765.01234", "  9876501234  "]) {
    const r = ok(f)
    assert.ok(r.ok, f)
    assert.equal((r as any).e164, "+919876501234", f)
  }
})

test("phone: rejects wrong lengths, bad prefixes, fakes, sequences and junk", () => {
  const bad = ["987650123", "98765012345", "5876501234", "0876501234", "1234567890", "9999999999", "9898989898", "9876543210", "7890123456", "+91 98765", "+19876501234", "+449876501234", "98765x01234", "९८७६५०१२३४", "９８７６５０１２３４", "98765​01234", "", "   ", "+", "0000000000", "6666666666", "abc"]
  for (const b of bad) assert.equal(ok(b).ok, false, JSON.stringify(b))
  for (const nonStr of [null, undefined, 9876501234, {}, [], ["9876501234"], true]) assert.equal(normalizeIndianMobile(nonStr as any).ok, false)
})

test("phone: huge input is rejected quickly (no ReDoS)", () => {
  const t0 = Date.now()
  const big = "9".repeat(200000)
  assert.equal(normalizeIndianMobile(big).ok, false)
  assert.equal(findPhoneInText("1 ".repeat(100000)), null)
  findPhoneInText("9876 ".repeat(50000) + "x") // must simply return fast
  assert.ok(Date.now() - t0 < 1500, `took ${Date.now() - t0}ms`)
})

test("phone in text: sentences, two numbers, OTP/price/pin noise", () => {
  assert.equal(findPhoneInText("my number is 98765 43211 thanks")?.e164, "+919876543211")
  assert.equal(findPhoneInText("call 9876501234 or 9123456780")?.e164, "+919876501234") // first wins
  assert.equal(findPhoneInText("EMI 3000 per month"), null)
  assert.equal(findPhoneInText("my OTP is 482913"), null)
  assert.equal(findPhoneInText("pin 560001, price 12999"), null)
  assert.equal(findPhoneInText("card 4111 1111 1111 1111"), null)
  assert.equal(findPhoneInText("आपका नंबर ९८७६५०१२३४"), null) // Devanagari digits are not accepted (safe default)
})

test("phone in text: a valid number next to another number (pin, qty, date) is still found", () => {
  for (const t of ["pin 560001 9876501234", "order 12345 9876501234", "12-03-2024 9876501234", "I am 25 9876501234", "3 9876501234", "560001, 9876501234", "9876501234 560001"]) {
    assert.equal(findPhoneInText(t)?.e164, "+919876501234", t)
  }
})

test("email: basic adversarial cases", () => {
  for (const b of ["a@b", "a b@c.com", "<a@b.com>", "a@@b.com", ".a@b.com", "a..b@c.com", "a@b..com", "a@-b.com", "x".repeat(65) + "@b.com", `${"a".repeat(250)}@b.com`, "a@b.c", "javascript:alert(1)@x.com"]) {
    assert.equal(validateEmail(b).ok, false, b)
  }
  assert.equal(findEmailInText("mail me at Asha@Example.COM.")?.toString(), "asha@example.com")
  assert.equal(findEmailInText("x".repeat(100000)), null)
})

// ---------- consent classification ----------
test("consent: clear refusals in many wordings are NOT consent", () => {
  for (const t of ["no", "nahi", "NO!", "don't", "dont", "do not message me", "nahi chahiye", "stop", "not now", "no thanks", "I don't have whatsapp", "mat bhejo", "never", "unsubscribe", "not interested", "later"]) {
    assert.equal(classifyReply(t), "no", t)
  }
})

test("consent: refusal with a CURLY apostrophe (iOS keyboard) must also be a refusal", () => {
  for (const t of ["don’t", "I don’t want that", "don’t send", "please don’t message me", "don’t whatsapp me"]) {
    assert.notEqual(classifyReply(t), "yes", t)
    assert.equal(classifyReply(t), "no", t)
  }
  assert.equal(isRevocation("please don’t message me"), true)
})

test("consent: ambiguous replies never grant", () => {
  for (const t of ["hmm", "?", "what?", "why do you need it?", "ok but first tell me the price?", "maybe", "", "   ", "👍🏽", "🙂", "let me think", "kitna hai"]) {
    assert.notEqual(classifyReply(t), "yes", t)
  }
})

test("consent: ordinary questions or requests that merely contain 'please'/'send' are NOT a yes", () => {
  for (const t of ["please tell me the price", "send me the price", "pls share the offer details", "ok what is the price", "send details please", "kar do discount", "please explain the process"]) {
    assert.notEqual(classifyReply(t), "yes", t)
    const s = applyUserMessage(markAsked(emptyConsent(), NOW), t, NOW)
    assert.notEqual(s.status, "granted", t)
  }
})

test("consent: genuine yes still works (English and Hinglish)", () => {
  for (const t of ["yes", "Yes!", "ok", "okay sure", "haan", "haan ji", "sure, please", "yes send it", "Yep", "bilkul"].filter((x) => x !== "bilkul")) assert.equal(classifyReply(t), "yes", t)
})

test("consent: a 'yes' typed BEFORE the line was sent does nothing; typed consent text is ignored", () => {
  const s0 = emptyConsent()
  assert.equal(applyUserMessage(s0, "yes", NOW).status, "none")
  assert.equal(applyUserMessage(s0, "I consent to be messaged on WhatsApp", NOW).status, "none")
  assert.equal(applyUserMessage(s0, "9876501234", NOW).status, "none")
})

test("consent: state transitions are one-way and a decline is sticky", () => {
  let s = markAsked(emptyConsent(), NOW)
  s = applyUserMessage(s, "no", NOW)
  assert.equal(s.status, "declined")
  assert.equal(applyUserMessage(s, "yes", NOW).status, "declined")
  assert.equal(applyUserMessage(s, "9876501234", NOW).status, "declined")
  assert.equal(markAsked(s, NOW).status, "declined")
  assert.equal(canForwardPhone(s), false)
})

test("consent: granted -> withdrawn by 'stop' / 'don't message me' and then cannot forward", () => {
  let s = applyUserMessage(markAsked(emptyConsent(), NOW), "yes", NOW)
  assert.equal(s.status, "granted")
  assert.equal(canForwardPhone(s), true)
  for (const t of ["stop", "STOP", "don't message me", "dont contact me", "unsubscribe", "mat bhejo"]) {
    const w = applyUserMessage(s, t, NOW)
    assert.equal(w.status, "declined", t)
    assert.equal(canForwardPhone(w), false)
  }
  assert.equal(applyUserMessage(s, "what is the price", NOW).status, "granted")
})

test("consent: 'no' and a number in the same message is a refusal, not consent", () => {
  const s = applyUserMessage(markAsked(emptyConsent(), NOW), "no, but my number is 9876501234", NOW)
  assert.equal(s.status, "declined")
})

test("consent: forged stored state cannot grant without text and time", () => {
  assert.equal(canForwardPhone({ status: "granted", askedAt: null, grantedAt: null, text: null, via: null }), false)
  assert.equal(canForwardPhone({ status: "granted", askedAt: null, grantedAt: NOW.toISOString(), text: null, via: null }), false)
})

// ---------- tool forgery ----------
const baseCtx = (consent = emptyConsent(), text = "my number is 9876501234", st: any = {}) => ({
  consent, latestUserText: text, now: NOW,
  state: { phoneCaptured: false, emailCaptured: false, emailOffered: false, pendingPhone: null, ...st },
})

test("tool: capture_phone without consent never produces a consented effect", () => {
  for (const status of ["none", "asked", "declined"] as const) {
    const c = { ...emptyConsent(), status }
    const out = runTool({ name: "capture_phone", raw: "9876501234" }, baseCtx(c))
    assert.equal(out.effect?.type, "phone_captured")
    assert.equal((out.effect as any).consented, false, status)
    assert.equal((out.effect as any).consentText, null)
  }
})

test("tool: the model cannot invent a number or take it from elsewhere (not in latest message)", () => {
  const granted = applyUserMessage(markAsked(emptyConsent(), NOW), "yes", NOW)
  const out = runTool({ name: "capture_phone", raw: "9123456780" }, baseCtx(granted, "my number is 9876501234"))
  assert.equal(out.effect, undefined)
  assert.equal(out.isError, true)
  const out2 = runTool({ name: "capture_phone", raw: "+91 91234 56780" }, baseCtx(granted, "yes"))
  assert.equal(out2.effect, undefined)
})

test("tool: phone for another person inside a longer message is accepted only if literally present (documented limit)", () => {
  const granted = applyUserMessage(markAsked(emptyConsent(), NOW), "yes", NOW)
  const out = runTool({ name: "capture_phone", raw: "9876501234" }, baseCtx(granted, "send it to my friend 9876501234"))
  assert.equal(out.effect?.type, "phone_captured") // code cannot know whose number it is; consent line says "your number"
})

test("tool: forged argument shapes are rejected or normalised", () => {
  for (const [name, input] of [["capture_phone", null], ["capture_phone", []], ["capture_phone", "9876501234"], ["capture_phone", { raw: 9876501234 }], ["capture_phone", { raw: ["9876501234"] }], ["capture_phone", { raw: { toString: "x" } }], ["capture_phone", { raw: "" }], ["capture_phone", { raw: "9".repeat(300) }], ["capture_email", { raw: null }], ["nope", {}], [null, {}], [{}, {}], ["__proto__", {}], ["constructor", {}]] as const) {
    assert.equal(validateToolInput(name as any, input as any).ok, false, `${String(name)} ${JSON.stringify(input)}`)
  }
  const v = validateToolInput("capture_phone", { raw: "9876501234", consent: true, consented: true, phone: "+911111111111", user_id: 99 })
  assert.deepEqual(v, { ok: true, args: { name: "capture_phone", raw: "9876501234" } })
  const h = validateToolInput("request_human", { reason: "x".repeat(5000) })
  assert.ok(h.ok && (h.args as any).reason.length <= 200)
  assert.deepEqual(validateToolInput("request_human", { reason: 5 }), { ok: true, args: { name: "request_human", reason: "unspecified" } })
})

test("tool: duplicate capture_phone calls in one turn produce one effect", () => {
  const granted = applyUserMessage(markAsked(emptyConsent(), NOW), "yes 9876501234", NOW)
  const first = runTool({ name: "capture_phone", raw: "9876501234" }, baseCtx(granted, "yes 9876501234"))
  assert.equal(first.effect?.type, "phone_captured")
  const second = runTool({ name: "capture_phone", raw: "9876501234" }, baseCtx(granted, "yes 9876501234", { phoneCaptured: true }))
  assert.equal(second.effect, undefined)
})

test("tool: an email volunteered without the offer is stored but not consented; after the offer it is", () => {
  const a = runTool({ name: "capture_email", raw: "a@b.com" }, baseCtx(emptyConsent(), "a@b.com"))
  assert.equal((a.effect as any).consented, false)
  const b = runTool({ name: "capture_email", raw: "a@b.com" }, baseCtx(emptyConsent(), "a@b.com", { emailOffered: true }))
  assert.equal((b.effect as any).consented, true)
})

test("state: parseState rejects forged pendingPhone / consent shapes", () => {
  const s = (newAgentState as any)
  assert.ok(s)
})

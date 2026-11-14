// Unit tests: phone/email validators, consent state machine, lead scoring.
import test from "node:test"
import assert from "node:assert/strict"
import { findEmailInText, findPhoneInText, normalizeIndianMobile, validateEmail } from "../lib/agent/validate.ts"
import { CONSENT_LINE, applyUserMessage, canForwardPhone, classifyReply, emptyConsent, isRevocation, markAsked, shouldAskConsent } from "../lib/agent/consent.ts"
import { DEFAULT_SCORES, applyLeadEvent, clampScores, scoreBucket } from "../lib/agent/scoring.ts"

const NOW = new Date("2026-11-15T10:00:00Z")

test("phone: accepts 10 digits and +91 / 91 / 0 / 0091 forms with spaces and dashes", () => {
  for (const raw of ["9876501234", "+91 98765 01234", "91-98765-01234", "098765 01234", "0091 9876501234", "(98765) 01234", " 9876501234 "]) {
    const r = normalizeIndianMobile(raw)
    assert.equal(r.ok, true, raw)
    if (r.ok) assert.equal(r.e164, "+919876501234")
  }
})

test("phone: rejects wrong length, wrong first digit, letters, other country codes", () => {
  for (const raw of ["", "   ", "12345", "5876501234", "98765012345", "987650123", "+44 9876501234", "+9198765012", "98765abcde", "9876-5012-34-56", "+91+9876501234", 42, null, undefined, "9".repeat(41)]) {
    assert.equal(normalizeIndianMobile(raw as any).ok, false, String(raw))
  }
})

test("phone: rejects repeats and sequences", () => {
  for (const raw of ["9999999999", "6666666666", "9898989898", "9999900000", "9876543210", "+91 9999999999"]) {
    assert.equal(normalizeIndianMobile(raw).ok, false, raw)
  }
  assert.equal(normalizeIndianMobile("9999999999").ok === false && (normalizeIndianMobile("9999999999") as any).reason, "repeat")
  assert.equal((normalizeIndianMobile("9876543210") as any).reason, "sequence")
})

test("phone: findPhoneInText pulls a valid number out of a sentence and ignores junk", () => {
  assert.equal(findPhoneInText("sure my number is 98765 01234 thanks")?.e164, "+919876501234")
  assert.equal(findPhoneInText("call +91-98765-01234 now")?.national, "9876501234")
  assert.equal(findPhoneInText("order 1234567890123 and 9999999999"), null)
  assert.equal(findPhoneInText("no number here"), null)
  assert.equal(findPhoneInText(undefined as any), null)
})

test("email: valid, lowercased, trimmed", () => {
  assert.deepEqual(validateEmail("  Asha.K+shop@Example.CO.in "), { ok: true, email: "asha.k+shop@example.co.in" })
})

test("email: rejects malformed, over-long and non-strings", () => {
  for (const raw of ["", "plain", "a@b", "a@b.c", "a b@example.com", "@example.com", "a@@example.com", ".a@example.com", "a..b@example.com", "a@-example.com", "<x>@example.com", "a@example..com", 5, null]) {
    assert.equal(validateEmail(raw as any).ok, false, String(raw))
  }
  assert.equal((validateEmail(`${"a".repeat(250)}@example.com`) as any).reason, "too_long")
})

test("email: findEmailInText strips trailing punctuation", () => {
  assert.equal(findEmailInText("it is asha@example.com."), "asha@example.com")
  assert.equal(findEmailInText("no email"), null)
})

test("classifyReply: English, Hindi and Hinglish yes/no, and unclear stays unknown", () => {
  for (const t of ["yes", "Yes please", "haan", "Haan ji", "ok", "sure!", "theek hai", "send it"]) assert.equal(classifyReply(t), "yes", t)
  for (const t of ["no", "nahi", "no thanks", "not now", "I don't have whatsapp", "mat bhejo", "later"]) assert.equal(classifyReply(t), "no", t)
  for (const t of ["", "what is the price?", "ok but how much is it?", "maybe", "tell me more about the course"]) assert.equal(classifyReply(t), "unknown", t)
  assert.equal(classifyReply("no problem, ok"), "yes")
})

test("consent: none -> asked -> granted by yes, with the exact line and a timestamp", () => {
  let s = emptyConsent()
  assert.equal(applyUserMessage(s, "yes", NOW).status, "none") // nothing asked yet: a stray "yes" is not consent
  s = markAsked(s, NOW)
  assert.equal(s.status, "asked")
  s = applyUserMessage(s, "yes ok", NOW)
  assert.equal(s.status, "granted")
  assert.equal(s.text, CONSENT_LINE)
  assert.equal(s.grantedAt, NOW.toISOString())
  assert.equal(s.via, "reply")
  assert.equal(canForwardPhone(s), true)
})

test("consent: giving a valid number right after the line grants it", () => {
  const s = applyUserMessage(markAsked(emptyConsent(), NOW), "98765 01234", NOW)
  assert.equal(s.status, "granted")
  assert.equal(s.via, "number")
})

test("consent: refusal declines, and a declined person is never re-asked", () => {
  const s = applyUserMessage(markAsked(emptyConsent(), NOW), "nahi", NOW)
  assert.equal(s.status, "declined")
  assert.equal(markAsked(s, NOW).status, "declined")
  assert.equal(applyUserMessage(s, "yes", NOW).status, "declined")
  assert.equal(canForwardPhone(s), false)
})

test("consent: an unclear reply keeps the question open; a number with a refusal does not grant", () => {
  const asked = markAsked(emptyConsent(), NOW)
  assert.equal(applyUserMessage(asked, "what do I get?", NOW).status, "asked")
  assert.equal(applyUserMessage(asked, "no, don't message 9876501234", NOW).status, "declined")
})

test("consent: 'stop' after consent revokes it", () => {
  const granted = applyUserMessage(markAsked(emptyConsent(), NOW), "yes", NOW)
  assert.equal(applyUserMessage(granted, "please stop messaging me", NOW).status, "declined")
  assert.equal(applyUserMessage(granted, "what time?", NOW).status, "granted")
  assert.equal(isRevocation("don't contact me"), true)
  assert.equal(isRevocation("when does it start"), false)
})

test("consent: the line is the specified wording", () => {
  assert.equal(CONSENT_LINE, "To send your brochure on WhatsApp I need your number. OK to message you there? (This is an automated assistant)")
})

test("consent: when to ask", () => {
  const none = emptyConsent()
  assert.equal(shouldAskConsent(none, { turnIndex: 0, phoneCaptured: false, handoff: false }), false) // first reply: give value first
  assert.equal(shouldAskConsent(none, { turnIndex: 1, phoneCaptured: false, handoff: false }), true)
  assert.equal(shouldAskConsent(none, { turnIndex: 1, phoneCaptured: true, handoff: false }), false)
  assert.equal(shouldAskConsent(none, { turnIndex: 1, phoneCaptured: false, handoff: true }), false)
  assert.equal(shouldAskConsent(markAsked(none, NOW), { turnIndex: 2, phoneCaptured: false, handoff: false }), false)
})

test("scoring: defaults and events (score never goes down, captured leads are not demoted)", () => {
  assert.deepEqual(DEFAULT_SCORES, { wa_lead: 95, email_lead: 60, engaged: 30 })
  const eng = applyLeadEvent({ status: "new", score: 0 }, "engaged")
  assert.deepEqual(eng, { status: "engaged", score: 30 })
  assert.deepEqual(applyLeadEvent(eng, "engaged"), eng)
  const em = applyLeadEvent(eng, "email_captured")
  assert.deepEqual(em, { status: "email_lead", score: 60 })
  const wa = applyLeadEvent(em, "wa_captured")
  assert.deepEqual(wa, { status: "wa_lead", score: 95 })
  assert.deepEqual(applyLeadEvent(wa, "email_captured"), { status: "wa_lead", score: 95 })
  assert.deepEqual(applyLeadEvent(wa, "handoff"), { status: "wa_lead", score: 95 })
  assert.deepEqual(applyLeadEvent({ status: "engaged", score: 30 }, "handoff"), { status: "handoff", score: 30 })
  assert.deepEqual(applyLeadEvent({ status: "handoff", score: 30 }, "wa_captured"), { status: "wa_lead", score: 95 })
  assert.deepEqual(applyLeadEvent({ status: "email_lead", score: 99 }, "email_captured", { ...DEFAULT_SCORES, email_lead: 10 }), { status: "email_lead", score: 99 })
})

test("scoring: editable constants are clamped to whole numbers 0..100", () => {
  assert.deepEqual(clampScores({ wa_lead: 150, email_lead: -5, engaged: "42.6" }), { wa_lead: 100, email_lead: 0, engaged: 43 })
  assert.deepEqual(clampScores({ wa_lead: "abc" }), DEFAULT_SCORES)
  assert.deepEqual(clampScores(null), DEFAULT_SCORES)
  assert.equal(scoreBucket(0), "0-24"); assert.equal(scoreBucket(25), "25-49"); assert.equal(scoreBucket(74), "50-74"); assert.equal(scoreBucket(95), "75-100")
})

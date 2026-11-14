/**
 * Consent gate for WhatsApp / email capture. Pure state machine.
 *
 * Who calls this: lib/agent/engine.ts on every turn (before and after the model runs), lib/agent/tools.ts (is a
 * captured number allowed to leave Celra), tests.
 * Why: the exact consent wording is sent by CODE, never composed by the model, and the number only travels to the
 * business's WhatsApp tool when this machine says "granted". Rationale and the (non-legal) DPDP note: docs/AI-SALES-AGENT.md.
 *
 *   none --(code sends CONSENT_LINE)--> asked --yes / gives a valid number--> granted
 *                                         \--no--> declined (email is offered instead)
 *   granted --"stop" / "don't message me"--> declined
 */
import { findPhoneInText } from "./validate.ts"

/** The only wording we show. Keep in sync with the preview in the dashboard and with docs. */
export const CONSENT_LINE = "To send your brochure on WhatsApp I need your number. OK to message you there? (This is an automated assistant)"
/** Offered once, by code, after a refusal. Asking for an email is the fallback capture. */
export const EMAIL_OFFER_LINE = "No problem. If you like, share your email and the team will contact you there. (This is an automated assistant)"

export type ConsentStatus = "none" | "asked" | "granted" | "declined"

export interface ConsentState {
  status: ConsentStatus
  askedAt: string | null
  grantedAt: string | null
  /** The exact line the person agreed to (stored on the contact). */
  text: string | null
  via: "reply" | "number" | null
}

export const emptyConsent = (): ConsentState => ({ status: "none", askedAt: null, grantedAt: null, text: null, via: null })

const norm = (t: string) =>
  t.toLowerCase().replace(/no problem|no worries|not a problem/g, " ").replace(/[^\p{L}\p{N}\s']/gu, " ").replace(/\s+/g, " ").trim()

const YES = new Set(["yes", "y", "yeah", "yep", "yup", "ok", "okay", "sure", "haan", "han", "haa", "ha", "hanji", "ji", "theek", "thik", "kar", "bhej", "send", "please", "pls", "plz", "fine", "alright"])
const NO = new Set(["no", "nope", "nah", "nahi", "nahin", "nhi", "mat", "dont", "don't", "never", "stop", "later", "skip", "unsubscribe"])
const NO_PHRASES = [/\bnot now\b/, /\bdo not\b/, /\bno thanks\b/, /\bno thank you\b/, /\bdon'?t have (a )?whats ?app\b/, /\bnot interested\b/, /\bwithout whats ?app\b/]

/** yes / no / unknown for a short reply to the consent question. Conservative: anything unclear is "unknown". */
export function classifyReply(text: string): "yes" | "no" | "unknown" {
  if (typeof text !== "string") return "unknown"
  const t = norm(text.slice(0, 300))
  if (!t) return "unknown"
  const words = t.split(" ")
  if (words.some((w) => NO.has(w)) || NO_PHRASES.some((r) => r.test(t))) return "no"
  if (text.includes("?")) return "unknown" // a question, not an answer
  if (words.length <= 6 && words.some((w) => YES.has(w))) return "yes"
  return "unknown"
}

/** Wording like "stop" or "don't message me" after consent was given. */
export function isRevocation(text: string): boolean {
  return /\b(stop|unsubscribe)\b|\b(do not|don'?t|dont)\s+(message|contact|whatsapp|text)\b|\bmat\s+(bhejo|karo)\b/i.test(String(text || "").slice(0, 300))
}

/** Records that the consent line was sent. Only moves none -> asked; a refusal is never re-asked. */
export function markAsked(s: ConsentState, now: Date): ConsentState {
  return s.status === "none" ? { ...s, status: "asked", askedAt: now.toISOString() } : s
}

/** Applies the person's latest message to the consent state. */
export function applyUserMessage(s: ConsentState, text: string, now: Date): ConsentState {
  if (s.status === "granted") return isRevocation(text) ? { ...s, status: "declined" } : s
  if (s.status !== "asked") return s
  const verdict = classifyReply(text)
  if (verdict === "no") return { ...s, status: "declined" }
  const gaveNumber = !!findPhoneInText(text)
  if (verdict === "yes" || gaveNumber) {
    return { ...s, status: "granted", grantedAt: now.toISOString(), text: CONSENT_LINE, via: verdict === "yes" ? "reply" : "number" }
  }
  return s
}

/** True only when the number may be stored on the contact as consented and forwarded. */
export const canForwardPhone = (s: ConsentState) => s.status === "granted" && !!s.grantedAt && !!s.text

/** Should the code append the consent line to this reply? */
export function shouldAskConsent(s: ConsentState, p: { turnIndex: number; phoneCaptured: boolean; handoff: boolean }): boolean {
  return s.status === "none" && !p.phoneCaptured && !p.handoff && p.turnIndex >= 1
}

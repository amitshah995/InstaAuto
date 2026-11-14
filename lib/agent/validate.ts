/**
 * Validators for contact details the AI agent captures. Pure, no network.
 *
 * Who calls this: lib/agent/tools.ts (tool-argument validation), lib/agent/consent.ts (a number in a reply counts as
 * "gave the number right after the consent line"), lib/agent/engine.ts.
 * Why: the LLM never decides what is a valid phone or email. Code does, so a hallucinated or injected value cannot be stored.
 */

export type PhoneResult =
  | { ok: true; national: string; e164: string }
  | { ok: false; reason: "empty" | "format" | "repeat" | "sequence" }

const ASC = "01234567890123456789"
const DESC = "98765432109876543210"

/** Strip spaces, dashes, dots and brackets. Anything else non-numeric (except a leading +) is a format error. */
function digitsOnly(raw: string): { plus: boolean; digits: string } | null {
  const s = raw.trim()
  if (!s) return null
  const plus = s.startsWith("+")
  const body = (plus ? s.slice(1) : s).replace(/[\s\-.()]/g, "")
  if (!/^\d+$/.test(body)) return null
  return { plus, digits: body }
}

/** 10 digits starting 6-9, optional +91 / 91 / 0091 / 0 prefix. Rejects obvious fakes (9999999999, 9876543210, 9898989898). */
export function normalizeIndianMobile(raw: unknown): PhoneResult {
  if (typeof raw !== "string" || !raw.trim()) return { ok: false, reason: "empty" }
  if (raw.length > 40) return { ok: false, reason: "format" }
  const d = digitsOnly(raw)
  if (!d) return { ok: false, reason: "format" }
  let n = d.digits
  if (d.plus) {
    if (!n.startsWith("91") || n.length !== 12) return { ok: false, reason: "format" }
    n = n.slice(2)
  } else if (n.startsWith("0091") && n.length === 14) n = n.slice(4)
  else if (n.startsWith("91") && n.length === 12) n = n.slice(2)
  else if (n.startsWith("0") && n.length === 11) n = n.slice(1)
  if (!/^[6-9]\d{9}$/.test(n)) return { ok: false, reason: "format" }
  if (new Set(n).size <= 2) return { ok: false, reason: "repeat" }
  if (ASC.includes(n) || DESC.includes(n)) return { ok: false, reason: "sequence" }
  return { ok: true, national: n, e164: `+91${n}` }
}

/** Finds the first valid Indian mobile inside free text ("my number is 98765 43210 thanks"). Null when none. */
export function findPhoneInText(text: string): { national: string; e164: string } | null {
  if (typeof text !== "string") return null
  const re = /(?:\+|00)?\d[\d\s\-.()]{8,17}\d/g
  for (const m of text.slice(0, 2000).matchAll(re)) {
    const r = normalizeIndianMobile(m[0])
    if (r.ok) return { national: r.national, e164: r.e164 }
  }
  return null
}

export type EmailResult = { ok: true; email: string } | { ok: false; reason: "empty" | "format" | "too_long" }

export const EMAIL_MAX = 254

/** Practical email check: one @, sane local part, dotted domain, no spaces or angle brackets. Lowercased. */
export function validateEmail(raw: unknown): EmailResult {
  if (typeof raw !== "string" || !raw.trim()) return { ok: false, reason: "empty" }
  const e = raw.trim().toLowerCase()
  if (e.length > EMAIL_MAX) return { ok: false, reason: "too_long" }
  if (!/^[a-z0-9._%+\-]{1,64}@[a-z0-9](?:[a-z0-9\-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9\-]*[a-z0-9])?)*\.[a-z]{2,24}$/.test(e)) {
    return { ok: false, reason: "format" }
  }
  const [local] = e.split("@")
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return { ok: false, reason: "format" }
  return { ok: true, email: e }
}

/** First valid email inside free text, or null. */
export function findEmailInText(text: string): string | null {
  if (typeof text !== "string") return null
  for (const m of text.slice(0, 2000).matchAll(/[A-Za-z0-9._%+\-]{1,64}@[A-Za-z0-9.\-]{3,255}/g)) {
    const r = validateEmail(m[0].replace(/[.,;:!?]+$/, ""))
    if (r.ok) return r.email
  }
  return null
}

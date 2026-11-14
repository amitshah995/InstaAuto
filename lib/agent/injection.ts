/**
 * Prompt-injection hardening helpers. Pure.
 *
 * Who calls this: lib/agent/prompt.ts (cleaning untrusted text before it is placed in a prompt), lib/agent/engine.ts
 * (detecting "ignore previous instructions" style messages and filtering the model's reply before it is sent).
 * Why: follower messages, Reel captions and FAQs are all untrusted. They are only ever shown to the model inside data
 * tags with tag characters removed, and the reply is checked again on the way out.
 */

/** Removes anything tag-like, control characters and runs of whitespace, then cuts to `max` characters (code points). */
export function cleanUntrusted(s: unknown, max: number): string {
  const str = typeof s === "string" ? s : ""
  const cleaned = str
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁠﻿]/g, "")
    .replace(/<\/?[a-zA-Z_][^>]{0,40}>/g, "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
  const cps = Array.from(cleaned)
  return cps.length > max ? cps.slice(0, max).join("") : cleaned
}

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+|any\s+|the\s+|your\s+)?(previous|prior|above|earlier|preceding)\s+(instructions?|rules?|prompts?|messages?)/i,
  /disregard\s+(all\s+|any\s+|the\s+|your\s+)?(previous|prior|above|earlier|system)?\s*(instructions?|rules?|prompt)/i,
  /forget\s+(everything|all|your)\s+(you|instructions?|rules?)/i,
  /(reveal|show|print|repeat|tell me)\s+(me\s+)?(your|the)\s+(system\s+)?(prompt|instructions?|rules?)/i,
  /\bsystem\s+prompt\b/i,
  /you\s+are\s+now\b/i,
  /\bact\s+as\s+(a|an|the)\b/i,
  /\b(jailbreak|developer\s+mode|dan\s+mode)\b/i,
  /new\s+instructions?\s*:/i,
  /\bpretend\s+(to\s+be|you\s+are)\b/i,
  /previous\s+instructions?\s+(are|were)\s+(void|cancelled|invalid)/i,
  /<\/?\s*(system|assistant|business_knowledge|follower_message)\b/i,
]

/** True when a message looks like an attempt to steer the model. We still answer politely, but we count it. */
export function detectInjection(text: unknown): boolean {
  if (typeof text !== "string") return false
  const t = text.slice(0, 2000)
  return INJECTION_PATTERNS.some((r) => r.test(t))
}

/** Phrases that only appear in our own prompt. If a reply contains one, the prompt is leaking. */
const LEAK_MARKERS = ["STRICT RULES", "business_knowledge", "follower_message", "<instruction", "system prompt", "capture_phone", "request_human"]

const URL_RE = /\bhttps?:\/\/[^\s)>\]]+|\bwww\.[^\s)>\]]+/gi

/** Removes every URL that is not in `allowed`. */
export function stripDisallowedUrls(text: string, allowed: string[]): string {
  const ok = new Set(allowed.map((u) => u.replace(/[.,;:!?)]+$/, "").toLowerCase()))
  return text.replace(URL_RE, (u) => (ok.has(u.replace(/[.,;:!?)]+$/, "").toLowerCase()) ? u : "")).replace(/[ \t]{2,}/g, " ").trim()
}

/** URLs that appear in trusted knowledge text (offer, FAQ answers, caption). */
export function extractUrls(...texts: string[]): string[] {
  const out = new Set<string>()
  for (const t of texts) for (const m of String(t || "").matchAll(URL_RE)) out.add(m[0].replace(/[.,;:!?)]+$/, ""))
  return [...out]
}

/** Cuts at a word boundary, never in the middle of a character. */
export function truncateAtWord(text: string, max: number): string {
  const cps = Array.from(text)
  if (cps.length <= max) return text
  const cut = cps.slice(0, max).join("")
  const sp = cut.lastIndexOf(" ")
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).trimEnd()
}

/** Final filter for model text. Returns null when the reply must not be sent (empty, or leaking the prompt). */
export function sanitizeReply(text: unknown, opts: { allowedUrls: string[]; maxChars: number }): string | null {
  if (typeof text !== "string") return null
  // Check for leaks on the raw text first: stripping tags would hide a leaked "<business_knowledge>".
  const lower = text.toLowerCase()
  if (LEAK_MARKERS.some((m) => lower.includes(m.toLowerCase()))) return null
  let t = text.replace(/<\/?[a-zA-Z_][^>]{0,40}>/g, "").trim()
  if (!t) return null
  t = stripDisallowedUrls(t, opts.allowedUrls)
  t = truncateAtWord(t, opts.maxChars).trim()
  return t || null
}

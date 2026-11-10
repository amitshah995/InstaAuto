/**
 * Referral links (ig.me/m/<username>?ref=<code>) and the referral data Instagram sends when someone opens one.
 *
 * Who calls this: app/api/instagram/webhook/route.ts (DM section: reads the referral, picks the "ref" rule, records the
 * contact source), app/api/automations/route.ts (validates and de-duplicates ref codes), components/dashboard/RefLinkField.tsx
 * (builds the link and QR value), lib/contacts/source.ts (the `source` custom field), tests/batch1-referral.test.ts.
 * Why it exists: lets a creator put a link or QR code on a website, a bio, a flyer or an ad that opens the DM with a
 * code, so the right automation runs and the contact is labelled with where they came from.
 *
 * What Meta documents (checked 2026-11-10):
 * - Link: https://ig.me/m/<USERNAME>?ref=<REFERRAL_PARAMETER_CONTENT>; the ref is up to 2,083 characters of letters,
 *   digits, "-", "_" and "=". https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/messaging-api/ig-me
 * - The referral object {ref, source, type:"OPEN_THREAD"} arrives in three places: inside `message` (a new conversation
 *   where the person sends a message), inside `postback` (a new conversation started through an icebreaker), or directly
 *   on the messaging event as `referral` (an existing conversation: the "messaging_referral" webhook field). In an existing
 *   conversation the app has 24 hours to reply. https://developers.facebook.com/documentation/business-messaging/instagram-messaging/features/ig-me-links
 * - Naming inconsistency in Meta's docs: the webhook field list calls it `messaging_referral` (singular), the Instagram
 *   Login messaging guide says `messaging_referrals`. We never depend on the field name: we detect the object by shape.
 *   The owner must make sure the field their dashboard offers (it is "messaging_referral") is subscribed.
 * - `source` is "SHORTLINK" in one table and "SHORTLINKS" in the JSON examples; we do not depend on it.
 */

/** Codes we create: lowercase letters, digits, "-" and "_", 1..64 characters (a safe subset of Meta's allowed set). */
export const REF_CODE_MAX = 64
export const REF_CODE_RE = /^[a-z0-9_-]{1,64}$/

export function isValidRefCode(code: unknown): code is string {
  return typeof code === "string" && REF_CODE_RE.test(code)
}

/** Lowercases and trims user input. The automations API lowercases trigger values, so codes are always lowercase. */
export function normalizeRefCode(input: string): string {
  return String(input ?? "").trim().toLowerCase()
}

/** A readable starting code from the rule name plus a short random suffix, for example "summer-sale-k3x9". */
export function suggestRefCode(name: string, rand: () => number = Math.random): string {
  const slug = String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "")
  const suffix = Math.floor(rand() * 36 ** 4).toString(36).padStart(4, "0")
  return slug ? `${slug}-${suffix}` : `link-${suffix}`
}

/** Instagram handles: letters, digits, "." and "_" up to 30 characters. */
export function isValidHandle(h: unknown): h is string {
  return typeof h === "string" && /^[A-Za-z0-9._]{1,30}$/.test(h)
}

/** The shareable link, or null when the handle or code is not usable. */
export function buildRefLink(username: string | null | undefined, code: string): string | null {
  const handle = String(username ?? "").replace(/^@/, "")
  if (!isValidHandle(handle) || !isValidRefCode(code)) return null
  return `https://ig.me/m/${handle}?ref=${code}`
}

export interface ReferralInfo {
  ref: string
  source: string | null
  type: string | null
  /** Where in the webhook event it was found. */
  via: "message" | "postback" | "standalone"
}

function readReferralObject(o: any, via: ReferralInfo["via"]): ReferralInfo | null {
  if (!o || typeof o !== "object") return null
  const ref = typeof o.ref === "string" ? o.ref.trim() : ""
  if (!ref) return null
  return { ref, source: typeof o.source === "string" ? o.source : null, type: typeof o.type === "string" ? o.type : null, via }
}

/** Finds the referral object of one `messaging` event in any of its three documented places. */
export function extractReferral(event: any): ReferralInfo | null {
  if (!event || typeof event !== "object") return null
  return (
    readReferralObject(event.message?.referral, "message") ||
    readReferralObject(event.postback?.referral, "postback") ||
    readReferralObject(event.referral, "standalone")
  )
}

/** The "ref" rule for a code (DM source). Comparison ignores case because the API stores trigger values lowercased. */
export function findRefRule<T extends { trigger_source?: string; trigger_type?: string; trigger_value?: string }>(
  automations: T[],
  ref: string,
): T | null {
  const wanted = ref.trim().toLowerCase()
  if (!wanted) return null
  return (
    automations.find(
      (a) => (a.trigger_source === "dm" || !a.trigger_source) && a.trigger_type === "ref" && String(a.trigger_value ?? "").trim().toLowerCase() === wanted,
    ) ?? null
  )
}

/** Value stored in the contact's `source` custom field for a referral. */
export function sourceForRef(ref: string): string {
  return `ref:${ref.trim().toLowerCase()}`.slice(0, 80)
}

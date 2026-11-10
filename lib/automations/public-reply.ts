/**
 * Public comment replies ("Check your DMs!") for comment automations.
 *
 * Who calls this: app/api/instagram/webhook/route.ts (Part A, after a comment rule matched) to decide what, if
 * anything, to post under the comment; app/api/automations/route.ts (via lib/automations/sanitize.ts) to clamp what the
 * rule form saves; components/dashboard/PublicReplyField.tsx for the shared limits and the live preview.
 * Why it exists: the reply used to be one of three hardcoded strings for every rule. Now every rule owns a list of
 * variants stored at response_content.public_reply = { enabled, variants[] }.
 *
 * Why several variants and random rotation: Instagram can treat many identical replies from one account as spam, so the
 * same sentence under hundreds of comments is a risk. We rotate the variants at random and never repeat the previous
 * variant back to back when there are two or more. The owner is told to write several different ones (the more, the
 * safer). We make no promise about how Instagram treats the account.
 *
 * Backward compatible: a rule saved before this feature has no public_reply and keeps the old behaviour (the three
 * default phrases, random). Live comments default to OFF (there is no public reply flow for live in this app).
 */

export const MAX_PUBLIC_REPLY_VARIANTS = 10
export const MAX_PUBLIC_REPLY_LENGTH = 150
/** The three phrases that were hardcoded before this feature. Used when a rule has no public_reply configured. */
export const DEFAULT_PUBLIC_REPLIES = ["Check your DMs! 📥", "Sent! 🔥", "Check inbox! ✨"]

export interface PublicReplyConfig {
  enabled: boolean
  variants: string[]
}

/** Values the placeholders can be filled with. Missing values make the placeholder disappear cleanly. */
export interface PublicReplyVars {
  /** Instagram username without the @. */
  username?: string | null
  /** First word of the contact's saved name, or the username when we know no name. */
  firstName?: string | null
}

/**
 * Cleans what the UI/API sends: trims, drops empties and case-insensitive duplicates, cuts each variant to
 * MAX_PUBLIC_REPLY_LENGTH characters and keeps at most MAX_PUBLIC_REPLY_VARIANTS. Returns undefined when the input is not
 * a public_reply object at all (so the rule keeps the default behaviour).
 */
export function sanitizePublicReply(input: unknown): PublicReplyConfig | undefined {
  if (!input || typeof input !== "object") return undefined
  const raw = input as { enabled?: unknown; variants?: unknown }
  const seen = new Set<string>()
  const variants: string[] = []
  if (Array.isArray(raw.variants)) {
    for (const v of raw.variants) {
      if (typeof v !== "string") continue
      const t = Array.from(v.replace(/\s+/g, " ").trim()).slice(0, MAX_PUBLIC_REPLY_LENGTH).join("").trim()
      const key = t.toLowerCase()
      if (!t || seen.has(key)) continue
      seen.add(key)
      variants.push(t)
      if (variants.length >= MAX_PUBLIC_REPLY_VARIANTS) break
    }
  }
  return { enabled: raw.enabled !== false, variants }
}

/** True when any variant uses a placeholder that needs the commenter's saved name (so the webhook only queries then). */
export function variantsNeedName(variants: string[]): boolean {
  return variants.some((v) => /\{first_name\}/i.test(v))
}

/** First word of a saved name, otherwise the username. Pure. */
export function firstNameFrom(contactName: string | null | undefined, username: string | null | undefined): string | null {
  const n = (contactName || "").trim().split(/\s+/)[0]
  if (n) return n
  const u = (username || "").trim().replace(/^@/, "")
  return u || null
}

/**
 * Fills {first_name} and {username}. {username} becomes "@name" (a mention); a literal "@" in front of the placeholder
 * is absorbed so "@{username}" does not become "@@name". A placeholder without a value is removed together with one
 * neighbouring space, so "Thanks {first_name}!" with no name becomes "Thanks!" rather than "Thanks !".
 */
export function fillPlaceholders(template: string, vars: PublicReplyVars): string {
  const username = (vars.username || "").replace(/^@/, "")
  let out = template.replace(/@?\{username\}/gi, username ? `@${username}` : "\u0000")
  out = out.replace(/\{first_name\}/gi, vars.firstName ? vars.firstName : "\u0000")
  // Drop empty placeholders and the space left in front of them (or behind, at the start of the text).
  out = out.replace(/ ?\u0000/g, "").replace(/^\u0000/g, "")
  out = out.replace(/\s+([!?.,;:])/g, "$1").replace(/\s{2,}/g, " ").trim()
  // A removed name can leave stray punctuation: ", check" at the start, "Thanks,!" in the middle.
  out = out.replace(/^[,;:\s]+/, "").replace(/,\s*([!?.])/g, "$1")
  return out
}

/**
 * Picks one variant at random, never the same index as `lastIndex` when there is a choice.
 * `rand` is injectable (returns [0,1)) so tests are deterministic.
 */
export function pickVariantIndex(count: number, lastIndex: number | null, rand: () => number = Math.random): number {
  if (count <= 1) return 0
  if (lastIndex === null || lastIndex < 0 || lastIndex >= count) return Math.min(count - 1, Math.floor(rand() * count))
  // Choose among the other (count - 1) slots, skipping the previous one.
  const pick = Math.min(count - 2, Math.floor(rand() * (count - 1)))
  return pick >= lastIndex ? pick + 1 : pick
}

export interface PublicReplyChoice {
  /** The text to post, or null when no public reply should be sent. */
  text: string | null
  /** Index of the chosen variant in the list that was used (for the "avoid back-to-back repeat" memory). */
  index: number | null
}

/**
 * Decides the public reply for a matched comment rule.
 * - rule has no public_reply: old behaviour (3 default phrases) for post comments, nothing for live comments
 * - enabled false: nothing
 * - enabled true with no usable variants: the 3 default phrases
 */
export function resolvePublicReply(
  content: unknown,
  vars: PublicReplyVars,
  opts: { isLive?: boolean; lastIndex?: number | null; rand?: () => number } = {},
): PublicReplyChoice {
  const cfg = sanitizePublicReply((content as { public_reply?: unknown } | null)?.public_reply)
  if (!cfg) {
    if (opts.isLive) return { text: null, index: null }
    const i = pickVariantIndex(DEFAULT_PUBLIC_REPLIES.length, opts.lastIndex ?? null, opts.rand)
    return { text: DEFAULT_PUBLIC_REPLIES[i], index: i }
  }
  if (!cfg.enabled) return { text: null, index: null }
  const list = cfg.variants.length > 0 ? cfg.variants : DEFAULT_PUBLIC_REPLIES
  const i = pickVariantIndex(list.length, opts.lastIndex ?? null, opts.rand)
  const text = fillPlaceholders(list[i], vars)
  return text ? { text, index: i } : { text: null, index: null }
}

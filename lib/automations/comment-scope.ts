/**
 * Comment scope: which posts a comment rule listens to — one post/reel, all posts, or "the next post I publish".
 *
 * Who calls this: app/api/instagram/webhook/route.ts (Part A, to pick the rule for a comment and to pin a "next post"
 * rule), components/dashboard/CommentScopeField.tsx and AutomationList (labels), lib/automations/sanitize.ts (validates
 * the stored value), tests/batch1-scope.test.ts.
 * Why it exists: before, a rule was "one post" (specific_media_id set) or "every post" (not set). Creators want to set a
 * rule up BEFORE posting ("next reel"), which Instagram cannot express.
 *
 * How "next post" works (documented here on purpose): Meta has no "new media published" webhook for comments, so the rule
 * stores response_content.comment_scope = "next" and leaves specific_media_id empty ("pending"). When the first comment
 * that matches the rule arrives, the webhook reads the commented media's publish `timestamp` from the Graph API and
 * compares it with the rule's created_at:
 *   - media published AT OR AFTER the rule was created, and a feed post or reel (not a story, ad or live) -> eligible;
 *   - the webhook then PINS the rule: it writes specific_media_id = that media id with a compare-and-set
 *     (`WHERE specific_media_id IS NULL`), so two posts cannot both claim the rule. From then on the rule behaves like a
 *     normal "specific post" rule. If the timestamp cannot be read, the rule does NOT fire (better to miss than to bind
 *     to the wrong post).
 * Consequence: the rule only binds once somebody comments a matching keyword on the new post (or any comment, for a
 * reply-all rule). Comments on older posts never bind it.
 */
import { matchesAnyKeyword } from "../matching/keywords.ts"

export type CommentScope = "specific" | "all" | "next"

export interface ScopedRule {
  id?: string
  trigger_type?: string
  trigger_value?: string
  specific_media_id?: string | null
  created_at?: string | null
  response_content?: any
}

/** True when the rule is a "next post" rule that has not bound to a post yet. */
export function isNextPostPending(rule: ScopedRule): boolean {
  return rule.response_content?.comment_scope === "next" && !rule.specific_media_id
}

/** The scope as the owner sees it. A "next post" rule that is already pinned reads as a specific post. */
export function ruleScope(rule: ScopedRule): CommentScope {
  if (rule.specific_media_id) return "specific"
  return rule.response_content?.comment_scope === "next" ? "next" : "all"
}

/** Only these stored values are accepted; anything else is dropped by the sanitizer. */
export function isValidScope(v: unknown): v is CommentScope {
  return v === "specific" || v === "all" || v === "next"
}

function triggerMatches(rule: ScopedRule, text: string): boolean {
  if (rule.trigger_type === "reply_all") return true
  return rule.trigger_type === "keyword" && matchesAnyKeyword(text, rule.trigger_value)
}

/** Instagram returns timestamps like 2026-11-10T09:30:00+0000 (no colon in the offset). Returns ms or null. */
export function parseIgTimestamp(ts: unknown): number | null {
  if (typeof ts !== "string" || !ts) return null
  const fixed = ts.replace(/([+-]\d{2})(\d{2})$/, "$1:$2")
  const ms = Date.parse(fixed)
  return Number.isFinite(ms) ? ms : null
}

/** Media kinds a "next post" rule may bind to: feed posts and reels. Unknown kind is allowed (the timestamp still decides). */
const NEXT_POST_EXCLUDED_KINDS = new Set(["STORY", "AD", "LIVE"])

/** Pure decision: is this media new enough, and of a kind, to be claimed by a pending "next post" rule? */
export function isEligibleNextMedia(rule: ScopedRule, mediaPublishedMs: number | null, mediaProductType?: string | null): boolean {
  if (mediaPublishedMs === null) return false
  const created = Date.parse(String(rule.created_at ?? ""))
  if (!Number.isFinite(created)) return false
  if (mediaProductType && NEXT_POST_EXCLUDED_KINDS.has(String(mediaProductType).toUpperCase())) return false
  return mediaPublishedMs >= created
}

/**
 * True when answering this comment needs the media's publish time: some pending "next post" rule would match the
 * comment text. Lets the webhook skip the extra Graph API call for almost every comment.
 */
export function needsMediaTimestamp(rules: ScopedRule[], commentText: string): boolean {
  return rules.some((r) => isNextPostPending(r) && triggerMatches(r, commentText))
}

export interface CommentPick<T> {
  match: T | null
  /** True when `match` is a pending "next post" rule that must be pinned to this media before it fires. */
  pin: boolean
}

/**
 * Chooses the rule for a comment on a post/reel. Priority (same as before, with "next post" inserted):
 *  1. reply-all rule bound to this media  2. keyword rule bound to this media
 *  3. pending "next post" rule that matches and is eligible (then pinned)  4. global keyword rule ("all posts").
 * Pending next-post rules are never treated as global (that was the bug to avoid: an unbound rule with no media id
 * looks exactly like an "all posts" rule).
 */
export function pickCommentAutomation<T extends ScopedRule>(
  rules: T[],
  ctx: { mediaId: string; text: string; mediaPublishedMs: number | null; mediaProductType?: string | null },
): CommentPick<T> {
  const bound = rules.filter((r) => r.specific_media_id === ctx.mediaId)
  const replyAll = bound.find((r) => r.trigger_type === "reply_all")
  if (replyAll) return { match: replyAll, pin: false }
  const keyword = bound.find((r) => r.trigger_type === "keyword" && matchesAnyKeyword(ctx.text, r.trigger_value))
  if (keyword) return { match: keyword, pin: false }

  const next = rules.find(
    (r) => isNextPostPending(r) && triggerMatches(r, ctx.text) && isEligibleNextMedia(r, ctx.mediaPublishedMs, ctx.mediaProductType),
  )
  if (next) return { match: next, pin: true }

  const global = rules.find((r) => !r.specific_media_id && !isNextPostPending(r) && r.trigger_type === "keyword" && matchesAnyKeyword(ctx.text, r.trigger_value))
  return { match: global ?? null, pin: false }
}

/** Minimal slice of the Supabase client used to pin a rule; lets tests pass a fake. */
export interface PinClient {
  from(table: string): any
}

/**
 * Binds a pending "next post" rule to `mediaId` with a compare-and-set. Returns true when the rule is (now) bound to this
 * media: either we just pinned it, or a concurrent comment on the same post pinned it a moment earlier. Returns false when
 * the rule is bound to a different media (another post won) or the database call failed.
 */
export async function pinNextPostRule(client: PinClient, ruleId: string, mediaId: string): Promise<boolean> {
  try {
    const { data, error } = await client
      .from("automations")
      .update({ specific_media_id: mediaId })
      .eq("id", ruleId)
      .is("specific_media_id", null)
      .select("id")
    if (!error && Array.isArray(data) && data.length > 0) return true
    // Nothing updated: it may already be pinned (to this media by a parallel comment, or to another media).
    const { data: row } = await client.from("automations").select("specific_media_id").eq("id", ruleId).single()
    return !!row && row.specific_media_id === mediaId
  } catch {
    return false
  }
}

/** Reads a media's publish time and kind via the Graph API. Never throws; null time = could not read. */
export async function fetchMediaMeta(
  accessToken: string,
  mediaId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ publishedMs: number | null; productType: string | null }> {
  try {
    const res = await fetchImpl(
      `https://graph.instagram.com/v24.0/${encodeURIComponent(mediaId)}?fields=timestamp,media_product_type&access_token=${encodeURIComponent(accessToken)}`,
      { signal: AbortSignal.timeout(5000) },
    )
    const j: any = await res.json().catch(() => null)
    if (!j || j.error) return { publishedMs: null, productType: null }
    return { publishedMs: parseIgTimestamp(j.timestamp), productType: typeof j.media_product_type === "string" ? j.media_product_type : null }
  } catch {
    return { publishedMs: null, productType: null }
  }
}

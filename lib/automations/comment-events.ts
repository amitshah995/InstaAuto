/**
 * Pure helpers for comment-type webhook events (regular comments AND live comments).
 *
 * Who calls this: app/api/instagram/webhook/route.ts (Part A) for every `comments` / `live_comments`
 * change, and tests/batch1-live.test.ts.
 * Why it exists: the webhook used to read `change.value.id` / `.media.id` straight off the payload and only knew the
 * `comments` field. Live comments arrive under their own field and Meta documents two payload shapes (the shape differs
 * between "Business Login for Instagram" and "Facebook Login for Business"), so the parsing and the live-rule pick are
 * kept here as pure functions that can be unit-tested without Instagram.
 *
 * Meta facts this code relies on (checked 2026-11-10):
 * - Webhook field `live_comments` (alongside `comments`): https://developers.facebook.com/documentation/instagram-platform/webhooks
 *   "Notifications for Comments on Live media are only sent during the live broadcast." and the field needs Advanced Access.
 * - Payload: Business Login nests `id` (the comment id), `from{id,username}`, `text`, `media{id,media_product_type}` under
 *   `value`; Facebook Login uses `comment_id` instead of `id` (https://developers.facebook.com/documentation/instagram-platform/webhooks/examples).
 *   The docs also show the Business Login variant without a `changes` array, so both layouts are accepted here.
 * - Private replies: "For Instagram Live, private replies can only be sent during the live broadcast."
 *   (https://developers.facebook.com/documentation/instagram-platform/private-replies). One message per comment.
 */
import { matchesAnyKeyword } from "../matching/keywords.ts"

export interface RawChange {
  field: string
  value: any
}

/** Webhook field names that carry a comment on a post/reel (`comments`) or on a live broadcast (`live_comments`). */
export const COMMENT_FIELD = "comments"
export const LIVE_COMMENT_FIELD = "live_comments"

/**
 * Returns the list of {field, value} changes of one webhook entry, accepting both the classic
 * `entry.changes[]` layout and the flat `entry.field` + `entry.value` layout shown in Meta's docs.
 */
export function normalizeEntryChanges(entry: any): RawChange[] {
  if (Array.isArray(entry?.changes)) return entry.changes.filter((c: any) => c && typeof c.field === "string")
  if (entry && typeof entry.field === "string" && entry.value) return [{ field: entry.field, value: entry.value }]
  return []
}

export interface CommentEvent {
  commentId: string
  text: string
  senderId: string
  username: string | null
  mediaId: string
  mediaProductType: string | null
}

/** Reads a comment change value tolerantly (`id` or `comment_id`). Returns null when an essential id is missing. */
export function readCommentValue(value: any): CommentEvent | null {
  if (!value || typeof value !== "object") return null
  const commentId = value.id ?? value.comment_id
  const senderId = value.from?.id
  const mediaId = value.media?.id
  const text = typeof value.text === "string" ? value.text : ""
  if (!commentId || !senderId || !mediaId || !text) return null
  return {
    commentId: String(commentId),
    text,
    senderId: String(senderId),
    username: value.from?.username ? String(value.from.username) : null,
    mediaId: String(mediaId),
    mediaProductType: value.media?.media_product_type ? String(value.media.media_product_type) : null,
  }
}

/**
 * A live broadcast on Instagram lasts at most a few hours. Meta only sends live notifications while it is on air, so an
 * event whose `entry.time` is much older than now is a late redelivery and a private reply would be rejected anyway.
 */
export const LIVE_MAX_EVENT_AGE_MS = 5 * 60 * 60 * 1000

/** True when a live event is too old to still be "during the broadcast". entry.time is in seconds; missing = not stale. */
export function isStaleLiveEvent(entryTimeSec: unknown, nowMs: number): boolean {
  const t = Number(entryTimeSec)
  if (!Number.isFinite(t) || t <= 0) return false
  return nowMs - t * 1000 > LIVE_MAX_EVENT_AGE_MS
}

/**
 * How long a failed live private reply may still be retried by the failed-send retry job. Kept short because the reply
 * is only possible while the broadcast is on air; retrying it days later could only fail.
 */
export const LIVE_RETRY_WINDOW_MS = 10 * 60 * 1000

/**
 * Picks the rule for a live comment. Only rules created on the Live tab (trigger_source "live") are considered,
 * a keyword rule beats a "reply to every live comment" (reply_all) catch-all, like keyword beats wildcard for DMs.
 */
export function pickLiveAutomation<T extends { trigger_source?: string; trigger_type?: string; trigger_value?: string }>(
  automations: T[],
  commentText: string,
): T | null {
  const live = automations.filter((a) => a.trigger_source === "live")
  const keyword = live.find((a) => a.trigger_type === "keyword" && matchesAnyKeyword(commentText, a.trigger_value))
  if (keyword) return keyword
  return live.find((a) => a.trigger_type === "reply_all") ?? null
}

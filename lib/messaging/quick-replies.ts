/**
 * Quick replies: tappable answer chips shown under a text DM.
 *
 * Who calls this: lib/messaging/send-steps.ts (adds `quick_replies` to the Graph API message body),
 * lib/messaging/flow-runner.ts (same for flow message nodes), lib/automations/sanitize.ts (clamps what the API stores),
 * app/api/instagram/webhook/route.ts (finds which rule/flow a tapped chip belongs to), lib/flows/engine.ts (message
 * actions carry the chips), and the UI editors (components/dashboard/QuickRepliesField.tsx, flow builder).
 * Why it exists: lets a rule offer "Price / Book / Talk to us" chips instead of asking people to type a keyword.
 *
 * Meta limits (checked 2026-11-10, Instagram API with Instagram Login, "Quick Replies"):
 * https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/messaging-api/quick-replies
 * - at most 13 buttons, each title up to 20 characters (longer is truncated by Instagram), only content_type "text"
 *   (phone number / email quick replies are disabled on Instagram), not available on desktop.
 * - payload length is not documented; we cap it at 200 characters to stay safe.
 * - When a chip is tapped the chip disappears and its title is posted as a normal message, and the `messages` webhook
 *   carries message.quick_reply.payload next to message.text. So a tap also works as an ordinary keyword reply.
 */

export const QUICK_REPLY_MAX_COUNT = 13
export const QUICK_REPLY_TITLE_MAX = 20
export const QUICK_REPLY_PAYLOAD_MAX = 200
/** Max length of the text a chip can answer with on its own (same ceiling as a plain DM text). */
export const QUICK_REPLY_REPLY_MAX = 1000

export interface QuickReply {
  title: string
  /** Sent back by Instagram in message.quick_reply.payload when the chip is tapped. */
  payload: string
  /** Optional: text the account answers with when this chip is tapped (rules). Flows branch on conditions instead. */
  reply?: string
}

const cut = (s: string, max: number) => Array.from(s).slice(0, max).join("")

/** Payload derived from the title when none was given, so older/imported data still works. Deterministic. */
export function defaultQuickReplyPayload(title: string, index: number): string {
  const slug = title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_+|_+$/g, "").slice(0, 40)
  return `QR_${index}_${slug || "reply"}`
}

/**
 * Cleans a quick reply list: drops empty titles and duplicate titles (Instagram shows the title as the message, two
 * identical chips would be ambiguous), cuts titles to 20 characters, makes sure every chip has a payload, keeps 13.
 * Always returns an array (empty when nothing usable).
 */
export function sanitizeQuickReplies(input: unknown): QuickReply[] {
  if (!Array.isArray(input)) return []
  const out: QuickReply[] = []
  const seenTitles = new Set<string>()
  const seenPayloads = new Set<string>()
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue
    const r = raw as { title?: unknown; payload?: unknown; reply?: unknown }
    const title = typeof r.title === "string" ? cut(r.title.replace(/\s+/g, " ").trim(), QUICK_REPLY_TITLE_MAX).trim() : ""
    if (!title || seenTitles.has(title.toLowerCase())) continue
    let payload = typeof r.payload === "string" ? cut(r.payload.trim(), QUICK_REPLY_PAYLOAD_MAX) : ""
    if (!payload) payload = defaultQuickReplyPayload(title, out.length)
    if (seenPayloads.has(payload)) payload = cut(`${payload}_${out.length}`, QUICK_REPLY_PAYLOAD_MAX)
    const item: QuickReply = { title, payload }
    if (typeof r.reply === "string" && r.reply.trim()) item.reply = cut(r.reply.trim(), QUICK_REPLY_REPLY_MAX)
    seenTitles.add(title.toLowerCase())
    seenPayloads.add(payload)
    out.push(item)
    if (out.length >= QUICK_REPLY_MAX_COUNT) break
  }
  return out
}

/** The exact `quick_replies` array for the Send API (text chips only). Empty array = send no chips. */
export function buildQuickRepliesApi(input: unknown): { content_type: "text"; title: string; payload: string }[] {
  return sanitizeQuickReplies(input).map((q) => ({ content_type: "text" as const, title: q.title, payload: q.payload }))
}

export interface QuickReplyTarget {
  automation: any
  title: string
  reply: string
}

/** Every place a rule can hold chips: the single message, each sequence step, each flow message node. */
function* chipLists(content: any): Generator<unknown> {
  if (!content || typeof content !== "object") return
  if (Array.isArray(content.quick_replies)) yield content.quick_replies
  if (Array.isArray(content.steps)) for (const s of content.steps) if (Array.isArray(s?.quick_replies)) yield s.quick_replies
  if (content.flow?.nodes && typeof content.flow.nodes === "object") {
    for (const n of Object.values<any>(content.flow.nodes)) if (Array.isArray(n?.quick_replies)) yield n.quick_replies
  }
}

/**
 * Finds the chip that was tapped and the text it answers with. Only chips that have their own `reply` answer by
 * themselves; chips without a reply are left to the normal flow/keyword handling (their title arrives as text).
 * First match wins, in the order the automations are given.
 */
export function findQuickReplyTarget(automations: any[], payload: string): QuickReplyTarget | null {
  if (!payload) return null
  for (const a of automations) {
    for (const list of chipLists(a?.response_content)) {
      for (const q of sanitizeQuickReplies(list)) {
        if (q.payload === payload && q.reply) return { automation: a, title: q.title, reply: q.reply }
      }
    }
  }
  return null
}

/**
 * Rules whose trigger is a chip payload (trigger_type "quick_reply", or a "postback" rule whose value equals the payload).
 * Lets an owner point a chip at a separate rule. Case-insensitive because the API lower-cases trigger values.
 */
export function findQuickReplyRule(automations: any[], payload: string): any | null {
  if (!payload) return null
  const p = payload.toLowerCase()
  return (
    automations.find(
      (a) => (a?.trigger_type === "quick_reply" || a?.trigger_type === "postback") && String(a?.trigger_value || "").toLowerCase() === p,
    ) ?? null
  )
}

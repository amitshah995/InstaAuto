/**
 * Server-side cleanup of a rule's response_content before it is stored.
 *
 * Who calls this: app/api/automations/route.ts (POST and PUT). The UI already limits what it lets people type, but the
 * API is the real gate (the Android app and imports also post here), so every limit is re-applied here.
 * Why it exists: each Batch 1 feature adds an optional field to response_content (public_reply, quick_replies, cards,
 * comment_scope, flow conditions). This one function clamps them all, and leaves every other field untouched so existing
 * rules, templates and imports behave exactly as before.
 */
import { sanitizePublicReply } from "./public-reply.ts"
import { isValidScope } from "./comment-scope.ts"
import { normalizeCards } from "../messaging/cards.ts"
import { sanitizeQuickReplies } from "../messaging/quick-replies.ts"

/** Returns a copy of `content` with the Batch 1 fields clamped. Unknown fields pass through unchanged. */
export function sanitizeResponseContent(content: any): any {
  if (!content || typeof content !== "object" || Array.isArray(content)) return content
  const out = { ...content }

  if ("public_reply" in out) {
    const pr = sanitizePublicReply(out.public_reply)
    if (pr) out.public_reply = pr
    else delete out.public_reply
  }

  if ("comment_scope" in out && !isValidScope(out.comment_scope)) delete out.comment_scope

  // Carousel: clamp to 10 cards in Meta's limits. `card` (legacy, single) is left untouched, but when a carousel is saved
  // the first card is mirrored into `card` so older readers (previews, the Android app) still show something.
  if ("cards" in out) {
    const cards = Array.isArray(out.cards) ? normalizeCards({ cards: out.cards }) : []
    if (cards.length > 0) {
      out.cards = cards
      out.card = cards[0]
    } else {
      delete out.cards
    }
  }

  // Quick reply chips: on the single message, on each sequence step, and on flow message nodes.
  if ("quick_replies" in out) out.quick_replies = sanitizeQuickReplies(out.quick_replies)
  if (Array.isArray(out.steps)) {
    out.steps = out.steps.map((s: any) => (s && typeof s === "object" && "quick_replies" in s ? { ...s, quick_replies: sanitizeQuickReplies(s.quick_replies) } : s))
  }
  if (out.flow?.nodes && typeof out.flow.nodes === "object") {
    const nodes: Record<string, any> = {}
    for (const [id, n] of Object.entries<any>(out.flow.nodes)) {
      nodes[id] = n && typeof n === "object" && "quick_replies" in n ? { ...n, quick_replies: sanitizeQuickReplies(n.quick_replies) } : n
    }
    out.flow = { ...out.flow, nodes }
  }
  return out
}

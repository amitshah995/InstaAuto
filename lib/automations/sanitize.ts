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

/** Returns a copy of `content` with the Batch 1 fields clamped. Unknown fields pass through unchanged. */
export function sanitizeResponseContent(content: any): any {
  if (!content || typeof content !== "object" || Array.isArray(content)) return content
  const out = { ...content }

  if ("public_reply" in out) {
    const pr = sanitizePublicReply(out.public_reply)
    if (pr) out.public_reply = pr
    else delete out.public_reply
  }
  return out
}

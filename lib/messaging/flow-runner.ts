import { enqueueJob, INLINE_MAX_DELAY_S, schedulerEnabled, type SendCtx } from "@/lib/messaging/send-steps"
import { advance, type FlowGraph } from "@/lib/flows/engine"
import { addTagToContact } from "@/lib/contacts/tag-actions"
import { generateFlowReply } from "@/lib/flows/ai-reply"
import { releaseDm, reserveAiRun, reserveDm } from "@/lib/billing/usage"
import { getSupabaseServerClient } from "@/lib/supabase-server"
import { expandLinksForUser } from "@/lib/links/store"
import { buildQuickRepliesApi } from "@/lib/messaging/quick-replies"

export type { FlowGraph }

/**
 * Runs (or resumes) a branching flow. The walk itself is the pure `advance()`
 * (also used by the builder's test panel); this executes its actions for real:
 * sends DMs, applies tags, and hands long delays to the scheduler.
 *
 * skipFirstDelay: set by the cron when resuming a node whose delay already elapsed.
 */
export async function runFlow(
  accessToken: string,
  psid: string,
  flow: FlowGraph,
  currentNodeId: string,
  incomingText: string | null,
  opts: { ctx?: SendCtx; skipFirstDelay?: boolean; automationId?: string } = {},
): Promise<{ nodeId: string | null; sentTexts: string[]; scheduled?: boolean }> {
  const { actions, nodeId: stopNode } = advance(flow, currentNodeId, incomingText)
  const sentTexts: string[] = []
  let skipDelay = !!opts.skipFirstDelay

  for (const action of actions) {
    if (action.kind === "tag") {
      if (opts.ctx) await addTagToContact(opts.ctx.userId, psid, action.tag)
      continue
    }

    let text = action.kind === "message" ? action.text : ""
    if (action.kind === "message" && opts.ctx) text = await expandLinksForUser(opts.ctx.userId, text, "flow")
    if (action.kind === "ai") {
      let businessInfo: string | null = null
      if (opts.ctx) {
        const supabase = await getSupabaseServerClient()
        const { data: u } = await supabase.from("users").select("ai_context").eq("id", opts.ctx.userId).single()
        businessInfo = u?.ai_context ?? null
      }
      // Plan AI limit (daily). Over the limit: skip this AI step, the rest of the flow carries on.
      if (opts.ctx && !(await reserveAiRun(opts.ctx.userId)).allowed) continue
      const reply = await generateFlowReply({ instruction: action.instruction, businessInfo, followerMessage: incomingText })
      if (!reply) continue // AI off or failed: skip this step, the rest of the flow carries on
      text = reply
    }

    const delay = action.kind === "message" && !skipDelay ? action.delaySeconds : 0
    if (action.kind === "message") skipDelay = false
    if (delay > INLINE_MAX_DELAY_S && opts.ctx && schedulerEnabled()) {
      const queued = await enqueueJob(opts.ctx, {
        kind: "flow",
        psid,
        payload: { flow, nodeId: action.nodeId, automationId: opts.automationId },
        delaySeconds: delay,
      })
      if (queued) return { nodeId: action.nodeId, sentTexts, scheduled: true }
    }
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay * 1000))

    // Plan DM limit: this direct send must be metered like sendSteps. Over the limit: skip the node.
    if (opts.ctx && !(await reserveDm(opts.ctx.userId)).allowed) continue
    let delivered = false
    try {
      const res = await fetch(
        `https://graph.instagram.com/v24.0/me/messages?access_token=${encodeURIComponent(accessToken)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipient: { id: psid },
            message: {
              text,
              // Quick reply chips of a message node (max 13 / 20 chars, sanitised in quick-replies.ts).
              ...(action.kind === "message" && text && buildQuickRepliesApi(action.quickReplies).length > 0
                ? { quick_replies: buildQuickRepliesApi(action.quickReplies) }
                : {}),
            },
          }),
        },
      )
      const json = await res.json()
      if (!json.error) {
        sentTexts.push(text)
        delivered = true
      }
    } catch (e) {
      console.error("[v0] 🔴 Flow node send error:", e)
    }
    if (!delivered && opts.ctx) await releaseDm(opts.ctx.userId) // failed sends are not billed
  }

  return { nodeId: stopNode, sentTexts }
}

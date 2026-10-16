import { enqueueJob, INLINE_MAX_DELAY_S, schedulerEnabled, type SendCtx } from "@/lib/messaging/send-steps"
import { advance, type FlowGraph } from "@/lib/flows/engine"
import { addTagToContact } from "@/lib/contacts/tag-actions"
import { generateFlowReply } from "@/lib/flows/ai-reply"
import { getSupabaseServerClient } from "@/lib/supabase-server"

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
    if (action.kind === "ai") {
      let businessInfo: string | null = null
      if (opts.ctx) {
        const supabase = await getSupabaseServerClient()
        const { data: u } = await supabase.from("users").select("ai_context").eq("id", opts.ctx.userId).single()
        businessInfo = u?.ai_context ?? null
      }
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

    try {
      const res = await fetch(
        `https://graph.instagram.com/v24.0/me/messages?access_token=${encodeURIComponent(accessToken)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipient: { id: psid }, message: { text } }),
        },
      )
      const json = await res.json()
      if (!json.error) sentTexts.push(text)
    } catch (e) {
      console.error("[v0] 🔴 Flow node send error:", e)
    }
  }

  return { nodeId: stopNode, sentTexts }
}

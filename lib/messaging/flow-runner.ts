import { enqueueJob, INLINE_MAX_DELAY_S, schedulerEnabled, type SendCtx } from "@/lib/messaging/send-steps"
import { advance, type FlowGraph } from "@/lib/flows/engine"
import { addTagToContact } from "@/lib/contacts/tag-actions"

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

    const delay = skipDelay ? 0 : action.delaySeconds
    skipDelay = false
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
          body: JSON.stringify({ recipient: { id: psid }, message: { text: action.text } }),
        },
      )
      const json = await res.json()
      if (!json.error) sentTexts.push(action.text)
    } catch (e) {
      console.error("[v0] 🔴 Flow node send error:", e)
    }
  }

  return { nodeId: stopNode, sentTexts }
}

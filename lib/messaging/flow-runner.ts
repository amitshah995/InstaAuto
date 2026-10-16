import { enqueueJob, INLINE_MAX_DELAY_S, schedulerEnabled, type SendCtx } from "@/lib/messaging/send-steps"

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export type FlowGraph = { startNodeId: string; nodes: Record<string, any> }

/**
 * Runs (or resumes) a branching flow built in the visual Flow Builder.
 * Walks forward sending message nodes until a condition node (needs the next reply),
 * the end of the flow, or a long delay (handed to the cron as a 'flow' job).
 * Capped at 20 hops so a cyclic graph can't hang a request.
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
  let nodeId: string | null = currentNodeId
  const sentTexts: string[] = []
  let hops = 0
  let skipDelay = !!opts.skipFirstDelay

  let node = flow.nodes[nodeId]
  if (node?.type === "condition") {
    const text = (incomingText || "").toLowerCase().trim()
    const branch = (node.branches || []).find(
      (b: any) => b.keyword && new RegExp(`\\b${escapeRegex(b.keyword.trim())}\\b`, "i").test(text),
    )
    nodeId = branch?.next || node.default_next || null
  }

  while (nodeId && hops < 20) {
    hops++
    node = flow.nodes[nodeId]
    if (!node) break
    if (node.type === "condition") break

    if (node.type === "message") {
      const delay = skipDelay ? 0 : node.delay_seconds || 0
      skipDelay = false
      if (delay > INLINE_MAX_DELAY_S && opts.ctx && schedulerEnabled()) {
        const queued = await enqueueJob(opts.ctx, {
          kind: "flow",
          psid,
          payload: { flow, nodeId, automationId: opts.automationId },
          delaySeconds: delay,
        })
        if (queued) return { nodeId, sentTexts, scheduled: true }
      }
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay * 1000))

      try {
        const res = await fetch(
          `https://graph.instagram.com/v24.0/me/messages?access_token=${encodeURIComponent(accessToken)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ recipient: { id: psid }, message: { text: node.text || "" } }),
          },
        )
        const json = await res.json()
        if (!json.error) sentTexts.push(node.text || "")
      } catch (e) {
        console.error("[v0] 🔴 Flow node send error:", e)
      }

      const nextNode = node.next ? flow.nodes[node.next] : null
      if (!nextNode) {
        nodeId = null
        break
      }
      if (nextNode.type === "condition") {
        nodeId = node.next
        break
      }
      nodeId = node.next
      continue
    }
    break
  }

  return { nodeId, sentTexts }
}

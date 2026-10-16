/**
 * Pure flow walker shared by the live runner (sends real DMs) and the in-builder
 * simulator (sends nothing), so a flow behaves in the test panel exactly as it
 * will in production.
 *
 * Graph node shapes:
 *   message   { type, text, delay_seconds?, next }
 *   tag       { type, tag, next }              // adds a CRM tag to the contact
 *   ai        { type, instruction, next }      // AI writes one reply from the instruction
 *   condition { type, branches:[{keyword,next}], default_next }
 */
export type FlowGraph = { startNodeId: string; nodes: Record<string, any> }

export type FlowAction =
  | { kind: "message"; nodeId: string; text: string; delaySeconds: number }
  | { kind: "tag"; nodeId: string; tag: string }
  | { kind: "ai"; nodeId: string; instruction: string }

const MAX_HOPS = 20

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function pickBranch(node: any, incomingText: string | null): string | null {
  const text = (incomingText || "").toLowerCase().trim()
  const branch = (node.branches || []).find(
    (b: any) => b.keyword && new RegExp(`\\b${escapeRegex(String(b.keyword).trim())}\\b`, "i").test(text),
  )
  return branch?.next || node.default_next || null
}

/**
 * Walks from currentNodeId and returns the ordered actions plus where the flow
 * stopped: a condition node (waiting for a reply) or null (finished).
 */
export function advance(
  flow: FlowGraph,
  currentNodeId: string,
  incomingText: string | null,
): { actions: FlowAction[]; nodeId: string | null; truncated: boolean } {
  const actions: FlowAction[] = []
  let nodeId: string | null = currentNodeId
  let hops = 0

  const start = flow.nodes[nodeId]
  if (start?.type === "condition") nodeId = pickBranch(start, incomingText)

  while (nodeId && hops < MAX_HOPS) {
    hops++
    const node = flow.nodes[nodeId]
    if (!node) return { actions, nodeId: null, truncated: false }

    if (node.type === "condition") return { actions, nodeId, truncated: false } // wait for the reply
    if (node.type === "message") {
      actions.push({ kind: "message", nodeId, text: node.text || "", delaySeconds: node.delay_seconds || 0 })
    } else if (node.type === "tag") {
      actions.push({ kind: "tag", nodeId, tag: node.tag || "" })
    } else if (node.type === "ai") {
      actions.push({ kind: "ai", nodeId, instruction: node.instruction || "" })
    } else {
      return { actions, nodeId: null, truncated: false } // unknown node type: stop safely
    }
    nodeId = node.next || null
  }
  return { actions, nodeId: null, truncated: hops >= MAX_HOPS && !!nodeId }
}

export type SimLine = { from: "bot" | "user" | "system"; text: string }

/** Plays a flow against scripted replies without sending anything. */
export function simulate(flow: FlowGraph, replies: string[]): { lines: SimLine[]; tags: string[]; finished: boolean; waitingFor: string[] } {
  const lines: SimLine[] = []
  const tags: string[] = []
  const run = (from: string, incoming: string | null): string | null => {
    const r = advance(flow, from, incoming)
    for (const a of r.actions) {
      if (a.kind === "message") {
        if (a.delaySeconds > 0) lines.push({ from: "system", text: `Waits ${a.delaySeconds}s` })
        lines.push({ from: "bot", text: a.text })
      } else if (a.kind === "ai") {
        lines.push({ from: "system", text: "AI reply (written live for each follower)" })
        lines.push({ from: "bot", text: `✨ AI reply based on: "${a.instruction.slice(0, 80)}"` })
      } else if (a.tag) {
        if (!tags.includes(a.tag)) tags.push(a.tag)
        lines.push({ from: "system", text: `Tag added: #${a.tag}` })
      }
    }
    if (r.truncated) lines.push({ from: "system", text: "Stopped: flow has a loop (max 20 steps)" })
    return r.nodeId
  }

  let current: string | null = run(flow.startNodeId, null)
  for (const reply of replies) {
    if (!current) break
    lines.push({ from: "user", text: reply })
    const before = current
    current = run(before, reply)
    if (current === before && flow.nodes[before]?.type === "condition") {
      lines.push({ from: "system", text: "No branch matched and no default path — flow ends" })
      current = null
    }
  }
  const waiting = current ? flow.nodes[current] : null
  const waitingFor: string[] =
    waiting?.type === "condition"
      ? (waiting.branches || []).map((b: any) => String(b.keyword || "").trim()).filter(Boolean)
      : []
  return { lines, tags, finished: current === null, waitingFor }
}

/**
 * Pure flow walker shared by the live runner (sends real DMs) and the in-builder
 * simulator (sends nothing), so a flow behaves in the test panel exactly as it
 * will in production. No network, no database: everything a decision needs comes in through `FlowContext`
 * (see lib/flows/conditions.ts) and everything the flow wants to do comes out as `FlowAction`s.
 *
 * Who calls this: lib/messaging/flow-runner.ts (production, executes the actions), components/flows/flow-tester.tsx and
 * app/flow-templates/[slug]/page.tsx (via simulate), tests/matcher.test.ts and tests/batch1-conditions.test.ts.
 *
 * Graph node shapes:
 *   message      { type, text, delay_seconds?, quick_replies?, next }   // text may contain {{variable}} / {{variable|fallback}}
 *   tag          { type, tag, next }                // adds a CRM tag to the contact
 *   remove_tag   { type, tag, next }                // removes a CRM tag from the contact
 *   set_variable { type, name, value, next }        // saves a value on the contact (custom field); value may use {{last_reply}}
 *   ai           { type, instruction, next }        // AI writes one reply from the instruction
 *   condition    { type, branches:[{keyword?, rules?, match?, next}], default_next, wait_for_reply? }
 *     - wait_for_reply absent or true (all flows saved before this feature): pause and wait for the person's next
 *       message, then route on it (branches keep working with just `keyword`).
 *     - wait_for_reply false: decide immediately from what we already know (tags, saved variables, follow status,
 *       time of day...), no reply needed. Used for rules that do not depend on a new message.
 *   A branch holds up to 5 rules joined by `match` "all" (AND, default) or "any" (OR); the first branch that fires wins,
 *   otherwise `default_next`.
 * Graph-level: `timezone` (IANA, default Asia/Kolkata) is the zone time-of-day rules use.
 */
import { interpolateVariables, evaluateBranch, branchRules, normalizeVarName, tagKey, type FlowContext } from "./conditions.ts"
import { sanitizeQuickReplies, type QuickReply } from "../messaging/quick-replies.ts"

export type { FlowContext } from "./conditions.ts"
export type FlowGraph = { startNodeId: string; nodes: Record<string, any>; timezone?: string }

export type FlowAction =
  | { kind: "message"; nodeId: string; text: string; delaySeconds: number; quickReplies: QuickReply[] }
  | { kind: "tag"; nodeId: string; tag: string }
  | { kind: "remove_tag"; nodeId: string; tag: string }
  | { kind: "set_variable"; nodeId: string; name: string; value: string }
  | { kind: "ai"; nodeId: string; instruction: string }

const MAX_HOPS = 20

/**
 * Chooses the next node of a condition node. `incoming` is either the person's text (the original call shape, still used
 * by tests and older callers) or a full FlowContext.
 */
export function pickBranch(node: any, incoming: string | null | FlowContext): string | null {
  const ctx: FlowContext = incoming !== null && typeof incoming === "object" ? incoming : { text: incoming || "" }
  // Unicode-aware whole-word match (works for Devanagari and other non-ASCII scripts) for the legacy keyword; see conditions.ts for the rest.
  const branch = (node.branches || []).find((b: any) => evaluateBranch(b || {}, ctx))
  return branch?.next || node.default_next || null
}

const isWaiting = (node: any) => node?.type === "condition" && node.wait_for_reply !== false

/**
 * Walks from currentNodeId and returns the ordered actions plus where the flow
 * stopped: a waiting condition node (waiting for a reply) or null (finished).
 * `ctx` carries what is already known about the person; the walker keeps its own copy of tags and variables up to date
 * as it passes tag / set_variable nodes, so a later condition sees what an earlier node just did.
 */
export function advance(
  flow: FlowGraph,
  currentNodeId: string,
  incomingText: string | null,
  ctx: FlowContext = {},
): { actions: FlowAction[]; nodeId: string | null; truncated: boolean; variables: Record<string, string>; tags: string[] } {
  const actions: FlowAction[] = []
  const state: FlowContext = {
    ...ctx,
    text: incomingText !== null ? incomingText : (ctx.text ?? null),
    variables: { ...(ctx.variables ?? {}) },
    tags: [...(ctx.tags ?? [])],
    timezone: ctx.timezone || flow.timezone,
  }
  const done = (nodeId: string | null, truncated = false) => ({ actions, nodeId, truncated, variables: state.variables!, tags: state.tags! })

  let nodeId: string | null = currentNodeId
  let hops = 0

  const start = flow.nodes[nodeId]
  if (isWaiting(start)) nodeId = pickBranch(start, state) // resuming: the person just answered

  while (nodeId && hops < MAX_HOPS) {
    hops++
    const node = flow.nodes[nodeId]
    if (!node) return done(null)

    if (node.type === "condition") {
      if (isWaiting(node)) return done(nodeId) // wait for the reply
      nodeId = pickBranch(node, state) // immediate: decide from what we know
      continue
    }
    if (node.type === "message") {
      actions.push({
        kind: "message",
        nodeId,
        text: interpolateVariables(node.text || "", state),
        delaySeconds: node.delay_seconds || 0,
        quickReplies: sanitizeQuickReplies(node.quick_replies),
      })
    } else if (node.type === "tag") {
      const tag = node.tag || ""
      actions.push({ kind: "tag", nodeId, tag })
      if (tagKey(tag) && !state.tags!.some((t) => tagKey(t) === tagKey(tag))) state.tags!.push(tag)
    } else if (node.type === "remove_tag") {
      const tag = node.tag || ""
      actions.push({ kind: "remove_tag", nodeId, tag })
      state.tags = state.tags!.filter((t) => tagKey(t) !== tagKey(tag))
    } else if (node.type === "set_variable") {
      const name = normalizeVarName(node.name)
      if (name && name !== "last_reply") {
        const value = interpolateVariables(String(node.value ?? ""), state).slice(0, 500)
        actions.push({ kind: "set_variable", nodeId, name, value })
        state.variables![name] = value
      }
    } else if (node.type === "ai") {
      actions.push({ kind: "ai", nodeId, instruction: node.instruction || "" })
    } else {
      return done(null) // unknown node type: stop safely
    }
    nodeId = node.next || null
  }
  return done(null, hops >= MAX_HOPS && !!nodeId)
}

export type SimLine = { from: "bot" | "user" | "system"; text: string }

/** Test data the simulator pretends to know about the person (the builder's "test as" panel). */
export interface SimOptions {
  tags?: string[]
  variables?: Record<string, string>
  follows?: FlowContext["follows"]
  inWindow?: boolean
  now?: Date
  timezone?: string
}

export interface SimResult {
  lines: SimLine[]
  /** Tags added along the path. */
  tags: string[]
  removedTags: string[]
  /** Variables set along the path. */
  variables: Record<string, string>
  finished: boolean
  waitingFor: string[]
  quickReplies: string[]
}

/** Plays a flow against scripted replies without sending anything. */
export function simulate(flow: FlowGraph, replies: string[], opts: SimOptions = {}): SimResult {
  const lines: SimLine[] = []
  const tags: string[] = []
  const removedTags: string[] = []
  const setVars: Record<string, string> = {}
  // Chips on the most recent bot message, shown as tappable suggestions in the test panel.
  let lastChips: QuickReply[] = []
  // What the pretend person "has" now: grows as the flow tags them or saves variables.
  let knownTags = [...(opts.tags ?? [])]
  let knownVars = { ...(opts.variables ?? {}) }

  const run = (from: string, incoming: string | null, tapped: string | null): string | null => {
    const r = advance(flow, from, incoming, {
      tags: knownTags,
      variables: knownVars,
      follows: opts.follows ?? "unknown",
      inWindow: opts.inWindow ?? true,
      now: opts.now,
      timezone: opts.timezone,
      quickReplyPayload: tapped,
    })
    knownTags = r.tags
    knownVars = r.variables
    for (const a of r.actions) {
      if (a.kind === "message") {
        if (a.delaySeconds > 0) lines.push({ from: "system", text: `Waits ${a.delaySeconds}s` })
        lines.push({ from: "bot", text: a.text })
        lastChips = a.quickReplies
      } else if (a.kind === "ai") {
        lines.push({ from: "system", text: "AI reply (written live for each follower)" })
        lines.push({ from: "bot", text: `✨ AI reply based on: "${a.instruction.slice(0, 80)}"` })
      } else if (a.kind === "remove_tag") {
        if (a.tag && !removedTags.includes(a.tag)) removedTags.push(a.tag)
        lines.push({ from: "system", text: `Tag removed: #${a.tag}` })
      } else if (a.kind === "set_variable") {
        setVars[a.name] = a.value
        lines.push({ from: "system", text: `Saved ${a.name} = "${a.value}"` })
      } else if (a.tag) {
        if (!tags.includes(a.tag)) tags.push(a.tag)
        lines.push({ from: "system", text: `Tag added: #${a.tag}` })
      }
    }
    if (r.truncated) lines.push({ from: "system", text: "Stopped: flow has a loop (max 20 steps)" })
    return r.nodeId
  }

  let current: string | null = run(flow.startNodeId, null, null)
  for (const reply of replies) {
    if (!current) break
    lines.push({ from: "user", text: reply })
    const before = current
    // Typing a chip's label counts as tapping the chip, like Instagram does (the title is posted as the message).
    const chip = lastChips.find((c) => c.title.toLowerCase() === reply.trim().toLowerCase())
    current = run(before, reply, chip ? chip.payload : null)
    if (current === before && isWaiting(flow.nodes[before])) {
      lines.push({ from: "system", text: "No branch matched and no default path — flow ends" })
      current = null
    }
  }
  const waiting = current ? flow.nodes[current] : null
  const waitingFor: string[] = []
  if (waiting?.type === "condition") {
    for (const b of waiting.branches || []) {
      for (const r of branchRules(b || {})) {
        if (r.kind === "text" && (r.op === "keyword" || r.op === "equals" || r.op === "phrase")) {
          const first = (r.op === "phrase" ? r.value : r.value.split(",")[0]).trim()
          if (first && !waitingFor.includes(first)) waitingFor.push(first)
        }
      }
    }
  }
  return { lines, tags, removedTags, variables: setVars, finished: current === null, waitingFor, quickReplies: current ? lastChips.map((c) => c.title) : [] }
}

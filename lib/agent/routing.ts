/**
 * Routing decisions for the webhook. Pure.
 *
 * Who calls this: app/api/instagram/webhook/route.ts (comment path: is this rule an agent rule; DM path: should this
 * message go to the agent).
 * Why: the webhook file is large, so the "who handles this DM" rule lives here where it can be unit-tested.
 */
export const AGENT_RESPONSE_KIND = "ai_agent"

/** True for a comment rule whose response is the AI Sales Agent (response_content.response_kind === "ai_agent"). */
export function isAgentRule(content: unknown): boolean {
  return !!content && typeof content === "object" && (content as any).response_kind === AGENT_RESPONSE_KIND
}

export type DmRoute =
  | { route: "agent" }
  | { route: "skip"; reason: "human_handled" | "outside_window" }
  | { route: "fallthrough"; reason: "no_agent_conversation" | "not_a_text_message" | "ref_link" | "quick_reply" | "agent_disabled" | "conversation_closed" }

export interface DmRouteInput {
  humanHandled: boolean
  withinWindow: boolean
  triggerType: string
  hasRefRule: boolean
  hasQuickReplyPayload: boolean
  agentEnabled: boolean
  agentConversation: { status: string } | null
}

/**
 * Order matters: a human owning the chat always wins, then Meta's 24h window, then explicit links/chips (which keep their
 * old behaviour), then the agent, then everything else (keyword rules, generic AI fallback) as before.
 */
export function routeIncomingDm(i: DmRouteInput): DmRoute {
  if (i.humanHandled) return { route: "skip", reason: "human_handled" }
  if (!i.withinWindow) return { route: "skip", reason: "outside_window" }
  if (!i.agentConversation) return { route: "fallthrough", reason: "no_agent_conversation" }
  if (i.agentConversation.status !== "active") return { route: "fallthrough", reason: "conversation_closed" }
  if (!i.agentEnabled) return { route: "fallthrough", reason: "agent_disabled" }
  if (i.triggerType !== "keyword") return { route: "fallthrough", reason: "not_a_text_message" }
  if (i.hasRefRule) return { route: "fallthrough", reason: "ref_link" }
  if (i.hasQuickReplyPayload) return { route: "fallthrough", reason: "quick_reply" }
  return { route: "agent" }
}

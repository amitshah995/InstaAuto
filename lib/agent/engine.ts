/**
 * The agent loop: one turn in, one reply + effects out. No database, no Instagram, no globals: the Anthropic call goes
 * through an injected fetch, so tests (and the "Test the agent" panel) run it without a network.
 *
 * Who calls this: lib/agent/runtime.ts (live DMs and the first private reply), app/api/ai-agent/test (simulation).
 * Why: keeps every decision (turn cap, cost cap, consent, validation, filtering) in pure code. The caller applies the
 * returned Effects (store the contact, set human_handled, dispatch the lead).
 * Env (same pattern as lib/flows/ai-reply.ts): ANTHROPIC_API_KEY, AGENT_MODEL (default claude-haiku-5-5), AGENT_ENABLED=0 to switch off.
 */
import { applyUserMessage, CONSENT_LINE, EMAIL_OFFER_LINE, emptyConsent, markAsked, shouldAskConsent } from "./consent.ts"
import { cleanUntrusted, detectInjection, extractUrls, sanitizeReply, truncateAtWord } from "./injection.ts"
import { chooseKnowledgeView } from "./rag/context.ts"
import { buildRetrievalQuery } from "./rag/keywords.ts"
import type { Retrieval } from "./rag/retrieve.ts"
import { buildIntroSystemPrompt, buildMessages, buildSystemPrompt, type AnthropicMessage } from "./prompt.ts"
import { runTool, TOOL_DEFS, validateToolInput } from "./tools.ts"
import {
  DM_TEXT_MAX, MAX_AGENT_TURNS, MAX_INJECTION_FLAGS, MAX_REPLY_TOKENS, MAX_TOKENS_PER_CONVERSATION,
  type AgentContext, type AgentState, type Effect, type HistoryItem,
} from "./types.ts"

export const HANDOFF_REPLY = "I'm connecting you with a team member who will reply here soon. Thanks for your patience! (This is an automated assistant)"
export const UNAVAILABLE_REPLY = "Sorry, I could not answer that just now. A team member will follow up. (This is an automated assistant)"
const MAX_MODEL_CALLS = 3

export const agentModel = () => process.env.AGENT_MODEL || "claude-haiku-5-5"
export const agentEnabled = () => !!process.env.ANTHROPIC_API_KEY && process.env.AGENT_ENABLED !== "0"

export function newAgentState(): AgentState {
  return { v: 1, status: "active", turn: 0, consent: emptyConsent(), pendingPhone: null, phoneCaptured: false, emailCaptured: false, emailOffered: false, tokensUsed: 0, injectionCount: 0 }
}

/** Reads a stored jsonb state defensively (older or hand-edited rows must never crash a turn). */
export function parseState(raw: unknown): AgentState {
  const base = newAgentState()
  if (!raw || typeof raw !== "object") return base
  const o = raw as Record<string, any>
  const c = o.consent && typeof o.consent === "object" ? o.consent : {}
  const status = ["none", "asked", "granted", "declined"].includes(c.status) ? c.status : "none"
  return {
    v: 1,
    status: ["active", "ended", "handoff"].includes(o.status) ? o.status : "active",
    turn: Number.isInteger(o.turn) && o.turn >= 0 ? o.turn : 0,
    consent: {
      status,
      askedAt: typeof c.askedAt === "string" ? c.askedAt : null,
      grantedAt: typeof c.grantedAt === "string" ? c.grantedAt : null,
      text: typeof c.text === "string" ? c.text : null,
      via: c.via === "reply" || c.via === "number" ? c.via : null,
    },
    pendingPhone: typeof o.pendingPhone === "string" && /^\+91[6-9]\d{9}$/.test(o.pendingPhone) ? o.pendingPhone : null,
    phoneCaptured: o.phoneCaptured === true,
    emailCaptured: o.emailCaptured === true,
    emailOffered: o.emailOffered === true,
    tokensUsed: Number.isFinite(o.tokensUsed) && o.tokensUsed >= 0 ? Math.floor(o.tokensUsed) : 0,
    injectionCount: Number.isInteger(o.injectionCount) && o.injectionCount >= 0 ? o.injectionCount : 0,
  }
}

export interface LlmDeps {
  fetchImpl?: typeof fetch
  apiKey?: string
  model?: string
  timeoutMs?: number
}

interface LlmResponse { content: any[]; stopReason: string | null; tokens: number }

/** One Messages API call. Returns null on any failure (no key, HTTP error, timeout, bad JSON). Never logs the key or message text. */
export async function callAnthropic(
  deps: LlmDeps,
  body: { system: string; messages: AnthropicMessage[]; tools?: readonly unknown[]; maxTokens?: number },
): Promise<LlmResponse | null> {
  const key = deps.apiKey ?? process.env.ANTHROPIC_API_KEY
  if (!key) return null
  const f = deps.fetchImpl ?? fetch
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), deps.timeoutMs ?? 15000)
  try {
    const res = await f("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: ctrl.signal,
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: deps.model ?? agentModel(),
        max_tokens: Math.min(body.maxTokens ?? MAX_REPLY_TOKENS, MAX_REPLY_TOKENS),
        system: body.system,
        messages: body.messages,
        ...(body.tools ? { tools: body.tools } : {}),
      }),
    })
    if (!res.ok) {
      console.error("[agent] model API error", res.status)
      return null
    }
    const json: any = await res.json()
    const content = Array.isArray(json?.content) ? json.content : []
    const tokens = (Number(json?.usage?.input_tokens) || 0) + (Number(json?.usage?.output_tokens) || 0)
    return { content, stopReason: typeof json?.stop_reason === "string" ? json.stop_reason : null, tokens }
  } catch (e) {
    console.error("[agent] model call failed:", (e as Error)?.name)
    return null
  } finally {
    clearTimeout(timer)
  }
}

const textOf = (content: any[]) => content.map((b) => (b?.type === "text" && typeof b.text === "string" ? b.text : "")).join("").trim()

export function allowedUrlsFor(ctx: AgentContext): string[] {
  const k = ctx.knowledge
  return extractUrls(k?.offer ?? "", k?.caption ?? "", ...(k?.faqs ?? []).map((f) => f.a), ctx.businessContext ?? "")
}

/** Deterministic first message used when the model is unavailable. Always discloses the automation. */
export function fallbackIntro(ctx: AgentContext): string {
  const topic = ctx.knowledge?.title ? ` about "${cleanUntrusted(ctx.knowledge.title, 80)}"` : ""
  return truncateAtWord(`Hi! I'm the automated assistant for ${cleanUntrusted(ctx.businessName, 60) || "this account"}. Thanks for your interest. Ask me anything${topic} and I'll answer from what the team has shared.`, DM_TEXT_MAX)
}

/** First private reply (<= 1000 chars, no links beyond the knowledge). Falls back to a template; never throws. */
export async function generateIntro(ctx: AgentContext, deps: LlmDeps = {}): Promise<{ text: string; usedModel: boolean; tokens: number }> {
  const res = await callAnthropic(deps, {
    system: buildIntroSystemPrompt(ctx),
    messages: [{ role: "user", content: "<follower_message>(they just commented on the Reel)</follower_message>" }],
  })
  const text = res ? sanitizeReply(textOf(res.content), { allowedUrls: allowedUrlsFor(ctx), maxChars: DM_TEXT_MAX }) : null
  if (!text) return { text: fallbackIntro(ctx), usedModel: false, tokens: res?.tokens ?? 0 }
  // The disclosure is a hard rule: if the model forgot it, code adds it.
  const disclosed = /automated|assistant|\bbot\b|\bAI\b/i.test(text)
  const DISCLOSURE = "(This is an automated assistant)"
  // Cut the model text first so a long reply cannot push the disclosure past the size limit.
  return { text: disclosed ? text : `${truncateAtWord(text, DM_TEXT_MAX - DISCLOSURE.length - 1)} ${DISCLOSURE}`, usedModel: true, tokens: res?.tokens ?? 0 }
}

export interface TurnInput {
  ctx: AgentContext
  state: AgentState
  history: HistoryItem[]
  userText: string
  now: Date
  /**
   * Knowledge retrieval for this turn (lib/agent/rag/service.ts). Optional: without it, or when it returns nothing usable, the
   * whole knowledge is placed in the prompt as before. It must never throw (a throw is caught and treated as "no retrieval").
   */
  retrieve?: (query: string) => Promise<Retrieval>
}

export interface TurnResult {
  /** Text to send, or null when nothing should be sent. */
  reply: string | null
  state: AgentState
  effects: Effect[]
  tokens: number
  modelCalls: number
  injectionSuspected: boolean
  usedFallback: boolean
  /** What retrieval did this turn (for the Test panel and debugging). No message text. */
  retrieval?: { mode: string; knowledgeMode: "stuffing" | "rag"; sourceTitles: string[]; chunks: number; fallbackReason: string | null }
}

/**
 * The consent question and the email offer are appended by code, and the state records that they were SHOWN. If the DM then
 * fails to send, the person never saw them, so a later "yes" must not count: put those two facts back as they were.
 */
export function revertUnsentLines(prev: AgentState, next: AgentState): AgentState {
  const out: AgentState = { ...next, consent: { ...next.consent } }
  if (prev.consent.status === "none" && next.consent.status === "asked") out.consent = { ...prev.consent }
  if (!prev.emailOffered && next.emailOffered) out.emailOffered = false
  return out
}

/** Composes the final DM: model text + at most one code-owned line, within the DM size limit. */
export function composeReply(modelText: string, extraLine: string | null): string {
  if (!extraLine) return truncateAtWord(modelText, DM_TEXT_MAX)
  const room = DM_TEXT_MAX - extraLine.length - 2
  return `${truncateAtWord(modelText, Math.max(0, room))}\n\n${extraLine}`.trim()
}

/** Runs one conversational turn. */
export async function runTurn(input: TurnInput, deps: LlmDeps = {}): Promise<TurnResult> {
  const { ctx, now } = input
  let state: AgentState = { ...input.state, consent: { ...input.state.consent } }
  const effects: Effect[] = []
  const result = (reply: string | null, extra: Partial<TurnResult> = {}): TurnResult => ({
    reply, state, effects, tokens: 0, modelCalls: 0, injectionSuspected: false, usedFallback: false, ...extra,
  })

  if (state.status !== "active") return result(null)

  const userText = cleanUntrusted(input.userText, 1000)
  // Checked on the raw text (tag spoofing) AND the cleaned text (zero-width characters split a phrase in the raw text only).
  const injection = detectInjection(input.userText) || detectInjection(userText)
  if (injection) state.injectionCount += 1

  // Hard caps first: turn count, token budget, repeated manipulation. They hand over to a human instead of spending more.
  const capReason =
    state.turn >= MAX_AGENT_TURNS ? "turn_limit" : state.tokensUsed >= MAX_TOKENS_PER_CONVERSATION ? "cost_limit" : state.injectionCount >= MAX_INJECTION_FLAGS ? "repeated_manipulation" : null
  if (capReason) {
    effects.push({ type: "handoff", reason: capReason })
    state = { ...state, status: "handoff" }
    return result(HANDOFF_REPLY, { injectionSuspected: injection })
  }

  // Consent is decided by code from the person's own words, before the model runs.
  const before = state.consent.status
  // Email counts as agreed-to only if the offer was already SHOWN in an earlier reply, not one we are about to append.
  const emailOfferedBefore = state.emailOffered
  state.consent = applyUserMessage(state.consent, userText, now)
  if (before === "asked" && state.consent.status === "declined" && !state.emailOffered) {
    state.emailOffered = true // the offer line is appended below
  }
  const justGranted = before !== "granted" && state.consent.status === "granted"
  if (justGranted && state.pendingPhone && !state.phoneCaptured) {
    effects.push({ type: "phone_captured", e164: state.pendingPhone, consented: true, consentText: state.consent.text, consentAt: state.consent.grantedAt })
    state.phoneCaptured = true
    state.pendingPhone = null
  }
  const justDeclined = before === "asked" && state.consent.status === "declined"

  let tokens = 0
  let modelCalls = 0
  const messages: AnthropicMessage[] = buildMessages(input.history, userText)

  // Retrieval: search the owner's knowledge for this question (and the last exchange, for short follow-ups like "kitna?").
  let retrieval: Retrieval | null = null
  if (input.retrieve) {
    try {
      retrieval = await input.retrieve(buildRetrievalQuery(userText, input.history))
    } catch {
      retrieval = null
    }
  }
  const view = chooseKnowledgeView(ctx.knowledge, retrieval)
  // Links are allowed if they are in the owner's knowledge text or in a passage retrieved for this turn.
  const turnUrls = view.mode === "rag" ? extractUrls(...view.passages.map((p) => p.content)) : []
  const allowedUrls = [...allowedUrlsFor(ctx), ...turnUrls]
  let modelText = ""
  let failed = false
  let handoff = effects.some((e) => e.type === "handoff")
  let ended = false

  for (let i = 0; i < MAX_MODEL_CALLS; i++) {
    const res = await callAnthropic(deps, {
      system: buildSystemPrompt(ctx, { consent: state.consent, emailOffered: state.emailOffered, injectionSuspected: injection, phoneCaptured: state.phoneCaptured }, view),
      messages,
      tools: TOOL_DEFS,
    })
    modelCalls++
    if (!res) { failed = true; break }
    tokens += res.tokens
    const toolUses = res.content.filter((b) => b?.type === "tool_use")
    modelText = textOf(res.content) || modelText
    if (toolUses.length === 0) break

    const toolResults: unknown[] = []
    for (const tu of toolUses) {
      const v = validateToolInput(tu.name, tu.input)
      if (!v.ok) {
        toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: `Error: ${v.error}`, is_error: true })
        continue
      }
      const out = runTool(v.args, { consent: state.consent, latestUserText: userText, state: { ...state, emailOffered: emailOfferedBefore }, now })
      if (out.effect) effects.push(out.effect)
      if (out.statePatch) state = { ...state, ...out.statePatch }
      if (out.effect?.type === "handoff") handoff = true
      if (out.effect?.type === "end") ended = true
      toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: out.result, ...(out.isError ? { is_error: true } : {}) })
    }
    messages.push({ role: "assistant", content: res.content })
    messages.push({ role: "user", content: toolResults })
    if (res.stopReason !== "tool_use") break
  }

  let reply = failed && !modelText ? null : sanitizeReply(modelText, { allowedUrls, maxChars: DM_TEXT_MAX })
  const usedFallback = reply === null
  if (reply === null) reply = handoff ? HANDOFF_REPLY : UNAVAILABLE_REPLY

  // Code-owned lines: the consent question, or the email offer after a refusal.
  let extra: string | null = null
  if (justDeclined && state.emailOffered && !state.emailCaptured && !handoff && !ended) extra = EMAIL_OFFER_LINE
  else if (shouldAskConsent(state.consent, { turnIndex: state.turn, phoneCaptured: state.phoneCaptured, handoff: handoff || ended })) {
    extra = CONSENT_LINE
    state.consent = markAsked(state.consent, now)
  }

  state.turn += 1
  state.tokensUsed += tokens
  if (handoff) state.status = "handoff"
  else if (ended) state.status = "ended"
  return result(composeReply(reply, extra), {
    tokens, modelCalls, injectionSuspected: injection, usedFallback,
    retrieval: retrieval
      ? { mode: retrieval.mode, knowledgeMode: view.mode, sourceTitles: retrieval.sourceTitles, chunks: retrieval.chunks.length, fallbackReason: retrieval.fallbackReason }
      : undefined,
  })
}

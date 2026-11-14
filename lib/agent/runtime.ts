/**
 * Glue between the pure agent engine and the outside world (database, Instagram sends, billing, outbound webhooks).
 *
 * Who calls this:
 *  - app/api/instagram/webhook/route.ts: prepareAgentIntro/commitAgentStart for a comment on an agent rule, handleAgentDm for a
 *    DM from a person with an active agent conversation.
 *  - app/api/ai-agent/*: buildContext and runSimulation (the "Test the agent" panel).
 * Why separate: everything with side effects is here, small and in one place; the decisions are in the pure files
 * (engine, consent, scoring, tools, routing, payload) which have unit tests.
 * Privacy: never logs phone numbers, emails, message text or tokens. Log lines carry only ids and short reason codes.
 */
import { rawQuery } from "@/lib/supabase-server"
import { sendSteps } from "@/lib/messaging/send-steps"
import { reserveAgentTurn } from "@/lib/billing/usage"
import { emitEvent } from "@/lib/webhooks/events"
import { agentEnabled, allowedUrlsFor, generateIntro, newAgentState, revertUnsentLines, runTurn, type TurnResult } from "./engine.ts"
import { createAgentStore, type AgentSettings } from "./store.ts"
import { applyLeadEvent, isLeadStatus, type LeadEvent, type LeadStatus } from "./scoring.ts"
import { LEAD_EVENT_EMAIL, LEAD_EVENT_WHATSAPP, buildLeadEventData, leadEventId } from "./payload.ts"
import { slideWindow } from "./rate.ts"
import { retrieverFor } from "./rag/service.ts"
import type { AgentContext, AgentState, Effect, HistoryItem } from "./types.ts"

export const agentStore = () => createAgentStore(rawQuery)

// Best-effort per-instance sliding window per account (the shared limit is the daily plan counter).
const callStamps = new Map<string, number[]>()

/** Rate guard + plan quota for one model call. */
export async function llmGate(userId: string | number): Promise<{ ok: true } | { ok: false; reason: string }> {
  const key = String(userId)
  const w = slideWindow(callStamps.get(key) ?? [], Date.now())
  callStamps.set(key, w.stamps)
  if (!w.allowed) return { ok: false, reason: "Too many AI replies in a minute" }
  const quota = await reserveAgentTurn(userId)
  return quota.allowed ? { ok: true } : { ok: false, reason: quota.message || "AI reply limit reached" }
}

/** Loads the knowledge for one Reel plus account settings into an AgentContext. Null knowledge means "use the business context". */
export async function buildContext(user: any, mediaId: string | null): Promise<{ ctx: AgentContext; settings: AgentSettings }> {
  const store = agentStore()
  const [knowledge, settings] = await Promise.all([mediaId ? store.getKnowledge(user.id, mediaId) : Promise.resolve(null), store.getSettings(user.id)])
  const ctx: AgentContext = {
    businessName: String(user.username || "the business"),
    businessContext: typeof user.ai_context === "string" && user.ai_context.trim() ? user.ai_context : null,
    knowledge: knowledge ? { mediaId: knowledge.mediaId, title: knowledge.title, caption: knowledge.caption, offer: knowledge.offer, faqs: knowledge.faqs } : null,
    tone: settings.tone,
    language: settings.language,
    handoffRules: settings.handoffRules,
    allowedUrls: [],
  }
  ctx.allowedUrls = allowedUrlsFor(ctx)
  return { ctx, settings }
}

export type IntroPrep = { ok: true; text: string; ctx: AgentContext; settings: AgentSettings } | { ok: false; reason: string }

/** Step 1 of a comment on an agent rule: write the first private reply from the Reel knowledge. Nothing is sent or stored yet. */
export async function prepareAgentIntro(user: any, mediaId: string): Promise<IntroPrep> {
  try {
    if (!agentEnabled()) return { ok: false, reason: "AI Sales Agent is not configured on this server" }
    const { ctx, settings } = await buildContext(user, mediaId)
    if (!settings.enabled) return { ok: false, reason: "AI Sales Agent is switched off" }
    if (!ctx.knowledge && !ctx.businessContext) return { ok: false, reason: "No Reel knowledge or business context to answer from" }
    const gate = await llmGate(user.id)
    if (!gate.ok) return { ok: false, reason: gate.reason }
    const intro = await generateIntro(ctx)
    return { ok: true, text: intro.text, ctx, settings }
  } catch (e) {
    console.error("[agent] intro failed:", (e as Error)?.message)
    return { ok: false, reason: "Agent error" }
  }
}

/** Step 2, after the private reply was delivered: remember the conversation and create the lead record (status new). */
export async function commitAgentStart(user: any, senderId: string, mediaId: string): Promise<void> {
  try {
    const store = agentStore()
    await store.startConversation(user.id, senderId, mediaId, newAgentState())
    const existing = await store.getContact(user.id, senderId)
    if (!isLeadStatus(existing?.lead_status)) await store.applyLead(user.id, senderId, { status: "new", score: 0, mediaId })
  } catch (e) {
    console.error("[agent] could not start conversation:", (e as Error)?.message)
  }
}

async function loadHistory(userId: string | number, igsid: string): Promise<HistoryItem[]> {
  const rows = await agentStore().getMessages(userId, igsid, 12)
  // rows are newest first. The newest incoming message is the one being answered now, so it is dropped here.
  const asc = [...rows].reverse()
  if (asc.length && asc[asc.length - 1].is_from_instagram) asc.pop()
  return asc.map((m: any) => ({ role: m.is_from_instagram ? ("user" as const) : ("assistant" as const), text: String(m.content ?? "") }))
}

async function dispatchLead(user: any, igsid: string, kind: "whatsapp" | "email", p: { mediaId: string; ctx: AgentContext; contactId: string | null; score: number; phone: string | null; email: string | null; consentAt: string | null; consentText: string | null }) {
  const store = agentStore()
  // One dispatch per person per Reel per kind, even if two requests race (unique key in lead_events).
  if (!(await store.claimLeadDispatch(user.id, igsid, p.mediaId, kind))) return
  const contact = await store.getContact(user.id, igsid)
  const data = buildLeadEventData({
    userId: user.id, igsid, contactId: p.contactId, name: contact?.name ?? null, phoneE164: p.phone, email: p.email,
    interest: p.ctx.knowledge?.title || null, mediaId: p.mediaId, consentGiven: true, consentAt: p.consentAt, consentText: p.consentText, score: p.score,
  })
  await emitEvent(user.id, kind === "whatsapp" ? LEAD_EVENT_WHATSAPP : LEAD_EVENT_EMAIL, data, { eventId: leadEventId(user.id, igsid, p.mediaId, kind) })
}

/** Applies the engine's effects: contact fields, status/score, handoff flag, and (only with consent) the AiSend/webhook dispatch. */
async function applyEffects(user: any, igsid: string, mediaId: string, effects: Effect[], ctx: AgentContext, settings: AgentSettings) {
  const store = agentStore()
  for (const e of effects) {
    const contact = await store.getContact(user.id, igsid)
    const cur = { status: (isLeadStatus(contact?.lead_status) ? contact.lead_status : "new") as LeadStatus, score: Number(contact?.lead_score) || 0 }
    const step = (ev: LeadEvent) => applyLeadEvent(cur, ev, settings.scores)
    if (e.type === "phone_captured") {
      if (!e.consented) {
        // No consent: kept as unverified_phone, never forwarded.
        const next = step("engaged")
        await store.applyLead(user.id, igsid, { ...next, mediaId, unverifiedPhone: e.e164 })
      } else {
        const next = step("wa_captured")
        const id = await store.applyLead(user.id, igsid, { ...next, mediaId, phone: e.e164, consentAt: e.consentAt, consentText: e.consentText })
        await dispatchLead(user, igsid, "whatsapp", { mediaId, ctx, contactId: id, score: next.score, phone: e.e164, email: null, consentAt: e.consentAt, consentText: e.consentText })
      }
    } else if (e.type === "email_captured") {
      const next = step("email_captured")
      const now = new Date().toISOString()
      const id = await store.applyLead(user.id, igsid, { ...next, mediaId, email: e.email, emailConsentAt: e.consented ? now : null })
      if (e.consented) await dispatchLead(user, igsid, "email", { mediaId, ctx, contactId: id, score: next.score, phone: null, email: e.email, consentAt: now, consentText: "Offered to be contacted by email (automated assistant)" })
    } else if (e.type === "handoff") {
      const next = step("handoff")
      await store.applyLead(user.id, igsid, { ...next, mediaId })
    }
  }
}

export type AgentDmOutcome = { handled: boolean; status: "sent" | "failed" | "skipped"; note?: string; handoff?: boolean }

/** One incoming DM from a person in an active agent conversation. Called by the webhook after the human_handled and 24h checks. */
export async function handleAgentDm(user: any, conv: { id: string | number } | null, senderId: string, text: string): Promise<AgentDmOutcome> {
  const store = agentStore()
  try {
    const ac = await store.getConversation(user.id, senderId)
    if (!ac || ac.status !== "active") return { handled: false, status: "skipped" }
    const gate = await llmGate(user.id)
    if (!gate.ok) return { handled: true, status: "skipped", note: gate.reason }

    const { ctx, settings } = await buildContext(user, ac.mediaId)
    // The owner paused the agent, or removed the Reel's knowledge: do not keep answering. Falls through to the account's other rules.
    if (!settings.enabled) return { handled: false, status: "skipped", note: "AI Sales Agent is switched off" }
    if (!ctx.knowledge && !ctx.businessContext) return { handled: false, status: "skipped", note: "No knowledge for this Reel" }
    const history = await loadHistory(user.id, senderId)

    // The person replied, so they are at least engaged.
    const contact = await store.getContact(user.id, senderId)
    if (!isLeadStatus(contact?.lead_status) || contact.lead_status === "new") {
      const n = applyLeadEvent({ status: "new", score: Number(contact?.lead_score) || 0 }, "engaged", settings.scores)
      await store.applyLead(user.id, senderId, { ...n, mediaId: ac.mediaId })
    }

    // Retrieval is scoped to this Reel (only while its knowledge is active) plus business-wide documents.
    const turn: TurnResult = await runTurn({ ctx, state: ac.state, history, userText: text, now: new Date(), retrieve: retrieverFor(user.id, ctx.knowledge ? ac.mediaId : null) })
    // Compare-and-set BEFORE sending: if another request already handled this conversation turn, drop this one.
    const saved = await store.saveConversation(user.id, senderId, ac.version, turn.state)
    if (!saved) return { handled: true, status: "skipped", note: "Conversation advanced by another request" }

    await applyEffects(user, senderId, ac.mediaId, turn.effects, ctx, settings)
    const handoff = turn.effects.some((e) => e.type === "handoff")

    let status: "sent" | "failed" = "sent"
    let note: string | undefined = turn.usedFallback ? "Fallback reply" : undefined
    if (turn.reply) {
      const sent = await sendSteps(user.access_token, { id: senderId }, senderId, { message: turn.reply }, { userId: user.id })
      if (!sent.ok) {
        status = "failed"
        note = sent.results[sent.results.length - 1]?.error
        // The person did not see the consent line / email offer: do not let a later "yes" count as consent to it.
        await store.saveConversation(user.id, senderId, ac.version + 1, revertUnsentLines(ac.state, turn.state)).catch(() => false)
      } else if (conv?.id !== undefined && conv?.id !== null) {
        await rawQuery(
          `INSERT INTO messages (id, conversation_id, user_id, sender_id, sender_username, content, is_from_instagram) VALUES ($1,$2,$3,$4,$5,$6,FALSE)`,
          [sent.results[0]?.messageId || `mid_agent_${Date.now()}_${Math.random()}`, conv.id, user.id, user.business_account_id, user.username, turn.reply],
        ).catch(() => {})
      }
    }
    // Handoff: silence every bot for this person (the Inbox shows the chat as human-handled).
    if (handoff) await rawQuery(`UPDATE conversations SET human_handled = TRUE WHERE user_id = $1 AND recipient_id = $2`, [user.id, senderId]).catch(() => {})
    return { handled: true, status, note, handoff }
  } catch (e) {
    console.error("[agent] DM handling failed:", (e as Error)?.message)
    return { handled: true, status: "failed", note: "Agent error" }
  }
}

/**
 * "Test the agent": runs the same engine against the owner's knowledge for a fake sender. Nothing is sent to Instagram, no
 * contact is touched, no lead is dispatched. The caller keeps `state` and `history` in the browser between turns.
 */
export async function runSimulation(user: any, mediaId: string | null, state: AgentState, history: HistoryItem[], text: string) {
  const gate = await llmGate(user.id)
  if (!gate.ok) return { ok: false as const, error: gate.reason }
  const { ctx } = await buildContext(user, mediaId)
  if (!ctx.knowledge && !ctx.businessContext) return { ok: false as const, error: "Add Reel knowledge (or business context in Settings) first." }
  const turn = await runTurn({ ctx, state, history, userText: text, now: new Date(), retrieve: retrieverFor(user.id, ctx.knowledge ? mediaId : null) })
  return { ok: true as const, turn }
}

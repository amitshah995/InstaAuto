/**
 * Shared types and limits for the AI Sales Agent. No logic here.
 * Who imports it: every file in lib/agent/*, the dashboard components and the API routes under app/api/ai-agent.
 */
import type { ConsentState } from "./consent.ts"

export const MAX_AGENT_TURNS = 12
export const HISTORY_WINDOW = 6
export const MAX_TOKENS_PER_CONVERSATION = 30_000
export const MAX_REPLY_TOKENS = 400
export const DM_TEXT_MAX = 1000
export const MAX_INJECTION_FLAGS = 3

export type Tone = "friendly" | "professional" | "casual"
export type Language = "auto" | "english" | "hindi" | "hinglish"
export const TONES: Tone[] = ["friendly", "professional", "casual"]
export const LANGUAGES: Language[] = ["auto", "english", "hindi", "hinglish"]

export interface Faq { q: string; a: string }
export interface Knowledge { mediaId: string; title: string; caption: string; offer: string; faqs: Faq[] }

export interface AgentContext {
  businessName: string
  /** users.ai_context, the owner's global notes. Used as a fallback when a Reel has no knowledge entry. */
  businessContext: string | null
  knowledge: Knowledge | null
  tone: Tone
  language: Language
  handoffRules: string
  /** Links the reply may contain (taken from the knowledge text). Everything else is stripped. */
  allowedUrls: string[]
}

export type AgentStatus = "active" | "ended" | "handoff"

export interface AgentState {
  v: 1
  status: AgentStatus
  turn: number
  consent: ConsentState
  /** A number given before consent: held in state until consent is granted, then forwarded. E.164. */
  pendingPhone: string | null
  phoneCaptured: boolean
  emailCaptured: boolean
  emailOffered: boolean
  tokensUsed: number
  injectionCount: number
}

export interface HistoryItem { role: "user" | "assistant"; text: string }

/** What the engine asks the caller (runtime or the test panel) to do. The engine itself never writes anywhere. */
export type Effect =
  | { type: "phone_captured"; e164: string; consented: boolean; consentText: string | null; consentAt: string | null }
  | { type: "email_captured"; email: string; consented: boolean }
  | { type: "handoff"; reason: string }
  | { type: "end" }

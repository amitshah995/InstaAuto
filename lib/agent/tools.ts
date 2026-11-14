/**
 * Tool definitions for the model, and the code that decides what each tool call really does. Pure.
 *
 * Who calls this: lib/agent/engine.ts for every tool_use block the model returns.
 * Why: the model may REQUEST capture_phone / capture_email / request_human / end_conversation, but code validates the
 * argument, checks it came from the person's own message (so a value the model invents or an injected one is refused),
 * checks consent, and only then produces an Effect. The model never writes to the database.
 */
import { canForwardPhone, type ConsentState } from "./consent.ts"
import { findEmailInText, findPhoneInText, normalizeIndianMobile, validateEmail } from "./validate.ts"
import type { AgentState, Effect } from "./types.ts"

export const TOOL_DEFS = [
  {
    name: "capture_phone",
    description: "Call when the person has typed their phone number. Pass the number exactly as they wrote it.",
    input_schema: { type: "object", properties: { raw: { type: "string", description: "The number as the person wrote it" } }, required: ["raw"], additionalProperties: false },
  },
  {
    name: "capture_email",
    description: "Call when the person has typed their email address. Pass it exactly as they wrote it.",
    input_schema: { type: "object", properties: { raw: { type: "string", description: "The email as the person wrote it" } }, required: ["raw"], additionalProperties: false },
  },
  {
    name: "request_human",
    description: "Call when you cannot answer from the knowledge, the person is upset or asks for a human, or a handoff rule applies.",
    input_schema: { type: "object", properties: { reason: { type: "string", description: "Short reason, under 200 characters" } }, required: ["reason"], additionalProperties: false },
  },
  {
    name: "end_conversation",
    description: "Call when the person says they are done or not interested.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
] as const

export type ToolName = (typeof TOOL_DEFS)[number]["name"]
export const isToolName = (n: unknown): n is ToolName => typeof n === "string" && TOOL_DEFS.some((t) => t.name === n)

export type ToolArgs =
  | { name: "capture_phone"; raw: string }
  | { name: "capture_email"; raw: string }
  | { name: "request_human"; reason: string }
  | { name: "end_conversation" }

/** Validates the shape of a tool call. Unknown tools and wrong types are errors; extra properties are dropped. */
export function validateToolInput(name: unknown, input: unknown): { ok: true; args: ToolArgs } | { ok: false; error: string } {
  if (!isToolName(name)) return { ok: false, error: "unknown tool" }
  const o = input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : null
  if (!o) return { ok: false, error: "arguments must be an object" }
  if (name === "end_conversation") return { ok: true, args: { name } }
  if (name === "request_human") {
    const reason = typeof o.reason === "string" ? o.reason.replace(/\s+/g, " ").trim().slice(0, 200) : ""
    return { ok: true, args: { name, reason: reason || "unspecified" } }
  }
  const raw = o.raw
  if (typeof raw !== "string" || !raw.trim()) return { ok: false, error: "raw must be a non-empty string" }
  if (raw.length > 254) return { ok: false, error: "raw is too long" }
  return { ok: true, args: { name, raw } }
}

export interface ToolContext {
  consent: ConsentState
  latestUserText: string
  /** E.164 numbers already captured in this conversation, so a repeat call is a no-op. */
  state: Pick<AgentState, "phoneCaptured" | "emailCaptured" | "emailOffered" | "pendingPhone">
  now: Date
}

export interface ToolOutcome {
  /** Text returned to the model as the tool_result. */
  result: string
  effect?: Effect
  statePatch?: Partial<Pick<AgentState, "pendingPhone" | "phoneCaptured" | "emailCaptured" | "status">>
  isError?: boolean
}

/** Decides what one validated tool call does. */
export function runTool(args: ToolArgs, ctx: ToolContext): ToolOutcome {
  switch (args.name) {
    case "capture_phone": {
      const parsed = normalizeIndianMobile(args.raw)
      if (!parsed.ok) return { result: `That is not a valid Indian mobile number (${parsed.reason}). Ask the person to check it.`, isError: true }
      // The number must be in the person's own latest message: the model cannot invent one or take one from a caption.
      const said = findPhoneInText(ctx.latestUserText)
      if (!said || said.national !== parsed.national) return { result: "That number is not in the person's latest message. Do not store it.", isError: true }
      if (ctx.state.phoneCaptured) return { result: "A number is already saved." }
      if (canForwardPhone(ctx.consent)) {
        return {
          result: "Number saved. Tell the person the team will message them on WhatsApp. Do not ask for anything else.",
          effect: { type: "phone_captured", e164: parsed.e164, consented: true, consentText: ctx.consent.text, consentAt: ctx.consent.grantedAt },
          statePatch: { phoneCaptured: true, pendingPhone: null },
        }
      }
      // No consent yet: keep it unverified. The system asks for consent itself; do not promise a WhatsApp message.
      return {
        result: "Number noted but NOT confirmed. The system will ask for consent. Do not promise a WhatsApp message and do not ask again.",
        effect: { type: "phone_captured", e164: parsed.e164, consented: false, consentText: null, consentAt: null },
        statePatch: { pendingPhone: parsed.e164 },
      }
    }
    case "capture_email": {
      const parsed = validateEmail(args.raw)
      if (!parsed.ok) return { result: `That is not a valid email (${parsed.reason}). Ask the person to check it.`, isError: true }
      const said = findEmailInText(ctx.latestUserText)
      if (!said || said !== parsed.email) return { result: "That email is not in the person's latest message. Do not store it.", isError: true }
      if (ctx.state.emailCaptured) return { result: "An email is already saved." }
      // Consent to be contacted by email = they were offered email and then typed one. A volunteered email is stored but not forwarded.
      const consented = ctx.state.emailOffered
      return {
        result: consented ? "Email saved. Tell the person the team will contact them there." : "Email saved.",
        effect: { type: "email_captured", email: parsed.email, consented },
        statePatch: { emailCaptured: true },
      }
    }
    case "request_human":
      return { result: "Handoff requested. Tell the person a team member will reply soon.", effect: { type: "handoff", reason: args.reason }, statePatch: { status: "handoff" } }
    case "end_conversation":
      return { result: "Conversation ended. Say a short goodbye.", effect: { type: "end" }, statePatch: { status: "ended" } }
  }
}

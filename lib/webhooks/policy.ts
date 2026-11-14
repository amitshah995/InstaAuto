/**
 * Pure rules for outbound webhooks: event names, retry schedule, payload shaping, Sheets preset.
 *
 * Who calls this: lib/webhooks/events.ts (delivery engine), the /api/webhooks routes, tests.
 * Why separate: the schedule and payload shapes are the contract with receivers, so they are
 * kept in one dependency-free file that is unit-tested.
 */
import crypto from "node:crypto"
import { aiSendBodyFromEventData } from "../agent/payload.ts"

export const WEBHOOK_EVENTS = ["lead_captured", "dm_sent", "dm_failed", "comment_matched", "lead.whatsapp_captured", "lead.email_captured"] as const
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]

// "aisend" = the AI Sales Agent connector: body is AiSend's lead-ingest JSON and the key travels in an x-api-key header.
export const WEBHOOK_PRESETS = ["generic", "sheets", "aisend"] as const
export type WebhookPreset = (typeof WEBHOOK_PRESETS)[number]

export const MAX_ENDPOINTS_PER_USER = 5
/** Consecutive dead deliveries after which an endpoint is switched off automatically. */
export const DISABLE_AFTER_DEAD = 20

/** Seconds to wait before attempt N+1 (index 0 = after the 1st failed attempt): 1m, 5m, 30m, 2h, 12h. */
const RETRY_DELAYS_SEC = [60, 300, 1800, 7200, 43200]
export const MAX_ATTEMPTS = RETRY_DELAYS_SEC.length + 1

/** Delay before the next attempt, or null when attempts are used up (delivery becomes "dead"). */
export function nextRetryDelaySec(attemptsMade: number): number | null {
  return RETRY_DELAYS_SEC[attemptsMade - 1] ?? null
}

export function isWebhookEvent(v: unknown): v is WebhookEvent {
  return typeof v === "string" && (WEBHOOK_EVENTS as readonly string[]).includes(v)
}

export interface Envelope {
  id: string
  event: WebhookEvent | "test"
  created_at: string
  data: Record<string, unknown>
}

export function buildEnvelope(event: Envelope["event"], data: Record<string, unknown>, id: string = crypto.randomUUID(), now: Date = new Date()): Envelope {
  return { id, event, created_at: now.toISOString(), data }
}

/**
 * Body actually sent. generic = the envelope as is. sheets = a FLAT object so a tiny Google Apps Script
 * can append a row without digging into nested JSON. Apps Script cannot read request headers, so the
 * sheets body carries `signature` = HMAC-SHA256(secret, event_id) (hex) instead of a header; the
 * snippet in docs/SHEETS.md recomputes it. The secret itself is never sent.
 */
export function shapePayload(preset: WebhookPreset | string, env: Envelope, secret: string): Record<string, unknown> {
  if (preset === "aisend") return aiSendBodyFromEventData(env.data)
  if (preset !== "sheets") return env as unknown as Record<string, unknown>
  const flat: Record<string, unknown> = { event: env.event, event_id: env.id, created_at: env.created_at }
  for (const [k, v] of Object.entries(env.data)) {
    // Nested values (custom fields) are stringified so every column holds plain text.
    flat[k] = v !== null && typeof v === "object" ? JSON.stringify(v) : v
  }
  flat.signature = crypto.createHmac("sha256", secret).update(env.id).digest("hex")
  return flat
}

/** Random signing secret shown once at creation. */
export function newSecret(): string {
  return `whsec_${crypto.randomBytes(24).toString("base64url")}`
}

/** Last 4 characters only, for display after creation. */
export function maskSecret(secret: string): string {
  return `whsec_••••${secret.slice(-4)}`
}

/** Apps Script answers a POST with a 302 to its result page after running doPost, so that counts as success. */
export function redirectCountsAsSuccess(preset: string, urlHost: string): boolean {
  return preset === "sheets" && /(^|\.)script\.google\.com$/i.test(urlHost)
}

/** What to do after one delivery attempt. Pure, so the retry behaviour is testable with a fake receiver. */
export type AttemptDecision = { kind: "delivered" } | { kind: "retry"; delaySec: number } | { kind: "dead" }

/**
 * Who calls it: lib/webhooks/events.ts after every attempt. Generic and sheets endpoints retry every failure on the
 * 1m/5m/30m/2h/12h schedule (unchanged). The aisend preset treats 4xx other than 408/429 as permanent (a wrong key or a bad
 * body will not fix itself), so a bad key does not generate hours of retries.
 */
export function decideAfterAttempt(preset: string, res: { ok: boolean; status?: number; permanent?: boolean }, attemptsMade: number): AttemptDecision {
  if (res.ok) return { kind: "delivered" }
  const clientError = preset === "aisend" && typeof res.status === "number" && res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429
  if (res.permanent || clientError) return { kind: "dead" }
  const delay = nextRetryDelaySec(attemptsMade)
  return delay === null ? { kind: "dead" } : { kind: "retry", delaySec: delay }
}

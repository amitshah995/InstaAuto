/**
 * Lead payloads and idempotency ids. Pure.
 *
 * Who calls this: lib/agent/runtime.ts (building the event data), lib/webhooks/policy.ts (shapePayload for the "aisend"
 * preset turns event data into the AiSend body), the connector "Send test lead" button, tests.
 * Contract: docs/AI-SALES-AGENT.md. Never put secrets or Instagram tokens in these objects.
 */
import crypto from "node:crypto"

export const LEAD_EVENT_WHATSAPP = "lead.whatsapp_captured"
export const LEAD_EVENT_EMAIL = "lead.email_captured"
export type LeadEventName = typeof LEAD_EVENT_WHATSAPP | typeof LEAD_EVENT_EMAIL

/** Stable, non-reversible id for a person (so receivers can correlate without ever seeing the Instagram id). */
export function hashIgsid(userId: string | number, igsid: string): string {
  return crypto.createHash("sha256").update(`celra:${userId}:${igsid}`).digest("hex").slice(0, 32)
}

/** Deterministic UUID-shaped id: the same person + reel + kind always produces the same id, so receivers can de-duplicate. */
export function leadEventId(userId: string | number, igsid: string, mediaId: string, kind: "whatsapp" | "email"): string {
  const h = crypto.createHash("sha256").update(`lead:${userId}:${igsid}:${mediaId}:${kind}`).digest("hex")
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`
}

export interface LeadEventInput {
  userId: string | number
  igsid: string
  contactId: string | null
  name: string | null
  phoneE164: string | null
  email: string | null
  interest: string | null
  mediaId: string
  consentGiven: boolean
  consentAt: string | null
  consentText: string | null
  score: number
}

/** Data carried by the outbound event (generic signed webhook receives exactly this inside the envelope). */
export function buildLeadEventData(i: LeadEventInput): Record<string, unknown> {
  return {
    contact_id: i.contactId,
    igsid_hash: hashIgsid(i.userId, i.igsid),
    name: i.name,
    phone: i.phoneE164,
    email: i.email,
    interest: i.interest,
    source_media_id: i.mediaId,
    consent_given: i.consentGiven,
    consent_at: i.consentAt,
    consent_text: i.consentText,
    score: i.score,
  }
}

const cut = (v: unknown, n: number): string | undefined => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : undefined)

/**
 * The exact JSON AiSend's POST /api/leads/ingest reads (x-api-key auth is a header, not part of this body).
 * Fields: source, name, phone (E.164), email, interest, campaign, consent, extra. `consent` is true only when the
 * consent gate passed. Takes the event data built above so the stored delivery and the sent body cannot drift apart.
 */
export function aiSendBodyFromEventData(d: Record<string, unknown>): Record<string, unknown> {
  const body: Record<string, unknown> = {
    source: "instagram_dm",
    campaign: "celra_ai_agent",
    consent: d.consent_given === true,
    extra: {
      celra_media_id: typeof d.source_media_id === "string" ? d.source_media_id : null,
      lead_score: typeof d.score === "number" ? d.score : null,
      consent_text: typeof d.consent_text === "string" ? d.consent_text : null,
      consent_at: typeof d.consent_at === "string" ? d.consent_at : null,
      ig_contact_id: typeof d.contact_id === "string" ? d.contact_id : null,
      source: "celra_ai_agent",
    },
  }
  const name = cut(d.name, 120)
  const phone = cut(d.phone, 20)
  const email = cut(d.email, 254)
  const interest = cut(d.interest, 300)
  if (name) body.name = name
  if (phone) body.phone = phone
  if (email) body.email = email
  if (interest) body.interest = interest
  return body
}

/**
 * Body for the "Send test lead" button. Email only (never a phone: the receiver may run a WhatsApp template for every
 * new lead), consent false, clearly labelled, so it is easy to spot and delete on the AiSend side.
 */
export function buildTestLeadData(userId: string | number): Record<string, unknown> {
  return buildLeadEventData({
    userId, igsid: "celra-test", contactId: null, name: "Celra test lead", phoneE164: null, email: "celra-test@example.com",
    interest: "Connection test from Celra", mediaId: "test", consentGiven: false, consentAt: null, consentText: null, score: 0,
  })
}

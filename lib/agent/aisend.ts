/**
 * AiSend connector helpers. Pure.
 *
 * Who calls this: app/api/ai-agent/aisend (saving the base URL) and tests.
 * AiSend's lead door is POST {base}/api/leads/ingest with an x-api-key header (contract in docs/AI-SALES-AGENT.md).
 * The URL is also re-checked by the SSRF guard (lib/webhooks/ssrf.ts) at save time and on every delivery.
 */
import { checkWebhookUrl } from "../webhooks/ssrf.ts"

export const AISEND_INGEST_PATH = "/api/leads/ingest"

/** Accepts the owner's AiSend base URL (https, public host, no credentials, no query) and returns it without a trailing slash. */
export function normalizeAiSendBaseUrl(raw: unknown): { ok: true; base: string } | { ok: false; reason: string } {
  const s = typeof raw === "string" ? raw.trim() : ""
  if (!s) return { ok: false, reason: "Enter your AiSend address, for example https://your-aisend.example" }
  const checked = checkWebhookUrl(s)
  if (!checked.ok) return { ok: false, reason: checked.reason }
  const u = checked.url
  if (u.search || u.hash) return { ok: false, reason: "Use the plain address, without ? or # parts. The key goes in the API key field." }
  return { ok: true, base: `${u.origin}${u.pathname.replace(/\/+$/, "")}` }
}

/** Full ingest URL for a base URL, or null when the base is not acceptable. */
export function aiSendIngestUrl(raw: unknown): string | null {
  const n = normalizeAiSendBaseUrl(raw)
  return n.ok ? `${n.base}${AISEND_INGEST_PATH}` : null
}

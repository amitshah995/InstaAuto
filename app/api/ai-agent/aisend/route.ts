/**
 * /api/ai-agent/aisend: the AiSend connector (a webhook endpoint with preset "aisend").
 *  GET -> { configured, url, enabled, hasKey } (the key is NEVER returned)
 *  PUT { baseUrl, apiKey?, enabled } -> save (apiKey required the first time; blank later keeps the stored key)
 *  DELETE -> remove
 * Who calls it: components/ai-agent/ConnectorCard.tsx. The key is encrypted like Instagram tokens (lib/token-crypto.ts)
 * and only ever sent to the stored, SSRF-checked URL by lib/webhooks/events.ts. The test button is /api/ai-agent/aisend/test.
 */
import { type NextRequest, NextResponse } from "next/server"
import { rawQuery } from "@/lib/supabase-server"
import { agentUser, failure } from "@/lib/agent/api"
import { createAgentStore } from "@/lib/agent/store"
import { aiSendIngestUrl, normalizeAiSendBaseUrl, AISEND_INGEST_PATH } from "@/lib/agent/aisend"
import { LEAD_EVENT_EMAIL, LEAD_EVENT_WHATSAPP } from "@/lib/agent/payload"
import { storeSecret } from "@/lib/webhooks/events"

const view = (c: any) =>
  c ? { configured: true, baseUrl: String(c.url).replace(AISEND_INGEST_PATH, ""), enabled: c.enabled === true, disabledReason: c.disabled_reason ?? null, hasKey: true } : { configured: false, baseUrl: "", enabled: false, disabledReason: null, hasKey: false }

export async function GET(request: NextRequest) {
  const u = agentUser(request)
  if (!u.ok) return u.res
  try {
    return NextResponse.json(view(await createAgentStore(rawQuery).getConnector(u.userId)))
  } catch (e) {
    return failure("aisend GET", e)
  }
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const u = agentUser(request, body?.userId)
  if (!u.ok) return u.res
  const base = normalizeAiSendBaseUrl(body?.baseUrl)
  if (!base.ok) return NextResponse.json({ error: base.reason }, { status: 400 })
  const key = typeof body?.apiKey === "string" ? body.apiKey.trim() : ""
  if (key && (key.length < 8 || key.length > 300 || /\s/.test(key))) return NextResponse.json({ error: "That API key does not look right." }, { status: 400 })
  try {
    const store = createAgentStore(rawQuery)
    const cur = await store.getConnector(u.userId)
    if (!cur && !key) return NextResponse.json({ error: "Paste the API key from your AiSend dashboard." }, { status: 400 })
    await store.saveConnector(u.userId, aiSendIngestUrl(base.base)!, key ? storeSecret(key) : null, body?.enabled !== false, [LEAD_EVENT_WHATSAPP, LEAD_EVENT_EMAIL])
    await store.saveSettings(u.userId, { connectorSkipped: false })
    return NextResponse.json(view(await store.getConnector(u.userId)))
  } catch (e) {
    return failure("aisend PUT", e)
  }
}

export async function DELETE(request: NextRequest) {
  const u = agentUser(request)
  if (!u.ok) return u.res
  try {
    await createAgentStore(rawQuery).removeConnector(u.userId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return failure("aisend DELETE", e)
  }
}

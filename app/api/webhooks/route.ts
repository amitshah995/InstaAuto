/**
 * /api/webhooks  (per-user outbound webhook endpoints)
 *  GET    -> endpoints (secret masked) + the 15 most recent deliveries
 *  POST   -> { url, events[], preset?, label? } create; the signing secret is returned ONCE
 *  PATCH  -> { id, enabled?, events?, label? } enable/disable or edit
 *  DELETE -> ?id=<n>
 * Who calls it: components/dashboard/WebhooksPanel.tsx (Settings page).
 * URLs are validated with the SSRF guard on save AND again on every delivery.
 */
import { type NextRequest, NextResponse } from "next/server"
import { authorizeUser } from "@/lib/auth"
import { rawQuery } from "@/lib/supabase-server"
import { checkWebhookUrl } from "@/lib/webhooks/ssrf"
import { MAX_ENDPOINTS_PER_USER, WEBHOOK_EVENTS, WEBHOOK_PRESETS, isWebhookEvent, maskSecret, newSecret } from "@/lib/webhooks/policy"
import { storeSecret } from "@/lib/webhooks/events"
import { decryptToken } from "@/lib/token-crypto"

const NOT_SETUP = { error: "Webhooks are not set up yet (run migration 28)." }

export async function GET(request: NextRequest) {
  const auth = authorizeUser(request, request.nextUrl.searchParams.get("userId"))
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  try {
    const endpoints = await rawQuery<any>(
      `SELECT id, label, url, secret, events, preset, enabled, disabled_reason, created_at FROM webhook_endpoints WHERE user_id=$1 ORDER BY id`,
      [auth.userId],
    )
    const deliveries = await rawQuery(
      `SELECT id, endpoint_id, event, status, attempts, last_status_code, last_error, created_at, delivered_at
         FROM webhook_deliveries WHERE user_id=$1 ORDER BY id DESC LIMIT 15`,
      [auth.userId],
    )
    return NextResponse.json({
      eventsAvailable: WEBHOOK_EVENTS,
      presets: WEBHOOK_PRESETS,
      endpoints: endpoints.map((e) => ({ ...e, secret: undefined, secretHint: maskSecret(decryptToken(e.secret)) })),
      deliveries,
    })
  } catch (e) {
    console.error("[webhooks] GET", (e as Error)?.message)
    return NextResponse.json(NOT_SETUP, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const auth = authorizeUser(request, body?.userId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const checked = checkWebhookUrl(String(body?.url || "").trim())
  if (!checked.ok) return NextResponse.json({ error: checked.reason }, { status: 400 })
  const events: string[] = Array.isArray(body?.events) ? body.events.filter(isWebhookEvent) : []
  if (events.length === 0) return NextResponse.json({ error: "Choose at least one event" }, { status: 400 })
  const preset = body?.preset === "sheets" ? "sheets" : "generic"
  const label = typeof body?.label === "string" ? body.label.trim().slice(0, 60) : null

  try {
    const [{ n }] = await rawQuery<{ n: number }>(`SELECT COUNT(*)::int AS n FROM webhook_endpoints WHERE user_id=$1`, [auth.userId])
    if (n >= MAX_ENDPOINTS_PER_USER) return NextResponse.json({ error: `You can add up to ${MAX_ENDPOINTS_PER_USER} webhooks.` }, { status: 400 })
    const secret = newSecret()
    const [row] = await rawQuery<{ id: number }>(
      `INSERT INTO webhook_endpoints (user_id, label, url, secret, events, preset) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [auth.userId, label, checked.url.toString(), storeSecret(secret), events, preset],
    )
    // The secret is shown only now. Later reads return a masked hint.
    return NextResponse.json({ id: row.id, secret })
  } catch (e) {
    console.error("[webhooks] POST", (e as Error)?.message)
    return NextResponse.json(NOT_SETUP, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const auth = authorizeUser(request, body?.userId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const id = Number(body?.id)
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Missing id" }, { status: 400 })
  try {
    if (typeof body.enabled === "boolean") {
      // Re-enabling clears the failure counter and the auto-disable note.
      await rawQuery(
        `UPDATE webhook_endpoints SET enabled=$3, consecutive_failures = CASE WHEN $3 THEN 0 ELSE consecutive_failures END,
           disabled_reason = CASE WHEN $3 THEN NULL ELSE 'Disabled by you' END WHERE id=$1 AND user_id=$2`,
        [id, auth.userId, body.enabled],
      )
    }
    if (Array.isArray(body.events)) {
      const events = body.events.filter(isWebhookEvent)
      if (events.length === 0) return NextResponse.json({ error: "Choose at least one event" }, { status: 400 })
      await rawQuery(`UPDATE webhook_endpoints SET events=$3 WHERE id=$1 AND user_id=$2`, [id, auth.userId, events])
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[webhooks] PATCH", (e as Error)?.message)
    return NextResponse.json(NOT_SETUP, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = authorizeUser(request, request.nextUrl.searchParams.get("userId"))
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const id = Number(request.nextUrl.searchParams.get("id"))
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Missing id" }, { status: 400 })
  try {
    await rawQuery(`DELETE FROM webhook_endpoints WHERE id=$1 AND user_id=$2`, [id, auth.userId])
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[webhooks] DELETE", (e as Error)?.message)
    return NextResponse.json(NOT_SETUP, { status: 500 })
  }
}

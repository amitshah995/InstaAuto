/**
 * Outbound webhook engine: queue events, deliver them signed, retry with backoff, keep a log.
 *
 * Who calls this:
 *  - emitEvent(): app/api/instagram/webhook/route.ts (via logRun and lead completion). Never throws.
 *  - processDueDeliveries(): app/api/cron/process-scheduled (retries and anything not yet sent).
 *  - sendTest(): app/api/webhooks/test.
 * Why a table-backed queue: the webhook request to Meta must stay fast and a receiver outage must
 * not lose events, so events are stored first, delivered right after the response (Next `after`),
 * and retried by the scheduler 1m / 5m / 30m / 2h / 12h later.
 * Safety: every request goes through safePost (SSRF guard, https only, 8s timeout, no redirects).
 */
import { after } from "next/server"
import { rawQuery } from "@/lib/supabase-server"
import { decryptToken, encryptToken } from "@/lib/token-crypto"
import { safePost } from "./safe-fetch.ts"
import { signPayload } from "./signing.ts"
import {
  DISABLE_AFTER_DEAD,
  type Envelope,
  type WebhookEvent,
  buildEnvelope,
  nextRetryDelaySec,
  redirectCountsAsSuccess,
  shapePayload,
} from "./policy.ts"

interface Endpoint {
  id: number
  user_id: number
  url: string
  secret: string
  preset: string
  enabled: boolean
}

// If the tables are missing (migration 28 not run) we stop querying for a while instead of failing on every event.
let missingUntil = 0

export const storeSecret = (plain: string) => encryptToken(plain)
const readSecret = (stored: string) => decryptToken(stored)

/** Queues an event for every enabled endpoint of this user that subscribed to it. Never throws. */
export async function emitEvent(userId: number | string, event: WebhookEvent, data: Record<string, unknown>): Promise<void> {
  if (Date.now() < missingUntil) return
  try {
    const eps = await rawQuery<{ id: number }>(
      `SELECT id FROM webhook_endpoints WHERE user_id=$1 AND enabled = TRUE AND $2 = ANY(events)`,
      [userId, event],
    )
    if (eps.length === 0) return
    const env = buildEnvelope(event, data)
    const ids: number[] = []
    for (const ep of eps) {
      const r = await rawQuery<{ id: number }>(
        `INSERT INTO webhook_deliveries (endpoint_id, user_id, event, event_id, payload) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [ep.id, userId, event, env.id, JSON.stringify(env)],
      )
      ids.push(r[0].id)
    }
    // Deliver right after the HTTP response is sent so Meta's webhook call is not slowed down.
    // Outside a request (tests, scripts) after() throws; the scheduler then delivers instead.
    try {
      after(() => deliverBatch(ids).then(() => undefined).catch(() => undefined))
    } catch {
      /* scheduler will pick it up */
    }
  } catch (e) {
    const msg = (e as Error)?.message || ""
    if (/webhook_endpoints|webhook_deliveries/.test(msg)) missingUntil = Date.now() + 5 * 60_000
    else console.error("[webhooks] emit failed:", msg)
  }
}

interface Claimed {
  id: number
  endpoint_id: number
  event: string
  event_id: string
  payload: Envelope
  attempts: number
}

/** Atomically claims deliveries (either the given ids or whatever is due) and delivers them. */
async function deliverBatch(ids: number[] | null, limit = 25) {
  const claimed = await rawQuery<Claimed>(
    `UPDATE webhook_deliveries SET attempts = attempts + 1, locked_until = now() + interval '2 minutes'
      WHERE id IN (
        SELECT id FROM webhook_deliveries
         WHERE status='pending' AND (locked_until IS NULL OR locked_until < now())
           AND ${ids ? "id = ANY($2)" : "next_attempt_at <= now()"}
         ORDER BY next_attempt_at LIMIT $1 FOR UPDATE SKIP LOCKED)
      RETURNING id, endpoint_id, event, event_id, payload, attempts`,
    ids ? [limit, ids] : [limit],
  )
  const summary = { claimed: claimed.length, delivered: 0, retrying: 0, dead: 0 }
  for (const d of claimed) {
    const r = await attemptDelivery(d)
    summary[r]++
  }
  return summary
}

async function attemptDelivery(d: Claimed): Promise<"delivered" | "retrying" | "dead"> {
  const [ep] = await rawQuery<Endpoint>(
    `SELECT id, user_id, url, secret, preset, enabled FROM webhook_endpoints WHERE id=$1`,
    [d.endpoint_id],
  )
  if (!ep || !ep.enabled) {
    await rawQuery(`UPDATE webhook_deliveries SET status='dead', last_error='Endpoint disabled or removed', locked_until=NULL WHERE id=$1`, [d.id])
    return "dead"
  }
  const res = await post(ep, d.payload)
  if (res.ok) {
    await rawQuery(
      `UPDATE webhook_deliveries SET status='delivered', delivered_at=now(), last_status_code=$2, last_error=NULL, locked_until=NULL WHERE id=$1`,
      [d.id, res.status ?? null],
    )
    await rawQuery(`UPDATE webhook_endpoints SET consecutive_failures=0 WHERE id=$1`, [ep.id])
    return "delivered"
  }
  const delay = res.permanent ? null : nextRetryDelaySec(d.attempts)
  if (delay === null) {
    await rawQuery(
      `UPDATE webhook_deliveries SET status='dead', last_status_code=$2, last_error=$3, locked_until=NULL WHERE id=$1`,
      [d.id, res.status ?? null, res.error ?? null],
    )
    // Too many dead deliveries in a row: switch the endpoint off so we stop hammering a broken receiver.
    await rawQuery(
      `UPDATE webhook_endpoints SET consecutive_failures = consecutive_failures + 1,
         enabled = CASE WHEN consecutive_failures + 1 >= $2 THEN FALSE ELSE enabled END,
         disabled_reason = CASE WHEN consecutive_failures + 1 >= $2 THEN 'Disabled automatically after repeated failures' ELSE disabled_reason END
       WHERE id=$1`,
      [ep.id, DISABLE_AFTER_DEAD],
    )
    return "dead"
  }
  await rawQuery(
    `UPDATE webhook_deliveries SET last_status_code=$2, last_error=$3, locked_until=NULL,
       next_attempt_at = now() + ($4 || ' seconds')::interval WHERE id=$1`,
    [d.id, res.status ?? null, res.error ?? null, String(delay)],
  )
  return "retrying"
}

/** Signs and sends one envelope to one endpoint. */
async function post(ep: Endpoint, env: Envelope) {
  const secret = readSecret(ep.secret)
  const body = JSON.stringify(shapePayload(ep.preset, env, secret))
  const ts = Math.floor(Date.now() / 1000)
  let host = ""
  try {
    host = new URL(ep.url).hostname
  } catch {
    /* safePost reports the bad URL */
  }
  return safePost(
    ep.url,
    body,
    {
      "Content-Type": "application/json",
      "User-Agent": "Celra-Webhooks/1.0",
      "X-Celra-Event": env.event,
      "X-Celra-Delivery": env.id,
      "X-Celra-Signature": signPayload(secret, body, ts),
    },
    { treatRedirectAsSuccess: redirectCountsAsSuccess(ep.preset, host) },
  )
}

/** Scheduler entry point: delivers everything due (new events not yet sent and retries). */
export async function processDueDeliveries(limit = 25) {
  try {
    return await deliverBatch(null, limit)
  } catch (e) {
    if (/webhook_deliveries/.test((e as Error)?.message || "")) return { claimed: 0, delivered: 0, retrying: 0, dead: 0 }
    throw e
  }
}

/** "Send test" button: delivers once, immediately, records it in the log, and is never retried. */
export async function sendTest(userId: number | string, endpointId: number) {
  const [ep] = await rawQuery<Endpoint>(
    `SELECT id, user_id, url, secret, preset, enabled FROM webhook_endpoints WHERE id=$1 AND user_id=$2`,
    [endpointId, userId],
  )
  if (!ep) return { ok: false as const, error: "Endpoint not found", status: undefined }
  const env = buildEnvelope("test", {
    message: "This is a test event from Celra.",
    igsid: "0000000000000000",
    name: "Test Person",
    email: "test@example.com",
    phone: "",
  })
  const res = await post(ep, env)
  await rawQuery(
    `INSERT INTO webhook_deliveries (endpoint_id, user_id, event, event_id, payload, status, attempts, last_status_code, last_error, delivered_at, next_attempt_at)
     VALUES ($1,$2,'test',$3,$4,$5,1,$6,$7,$8,now())`,
    [ep.id, userId, env.id, JSON.stringify(env), res.ok ? "delivered" : "dead", res.status ?? null, res.error ?? null, res.ok ? new Date().toISOString() : null],
  )
  return { ok: res.ok, status: res.status, error: res.error }
}


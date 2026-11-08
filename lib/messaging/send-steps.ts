import { getSupabaseServerClient } from "@/lib/supabase-server"
import { expandLinksForUser } from "@/lib/links/store"
import { expandTokens } from "@/lib/links/core"
import { classifyFailure, withRetry, type MetaError } from "@/lib/messaging/retry"
import { DM_WINDOW_MS, PRIVATE_REPLY_WINDOW_MS, recordFailedSend } from "@/lib/messaging/failed-sends"

/**
 * Shared DM sending for the webhook and the scheduled-message cron.
 *
 * Delays: short delays (<= INLINE_MAX_DELAY_S) wait inside the request as before.
 * Longer delays are stored as a durable job (scheduled_messages) and sent later by
 * /api/cron/process-scheduled — but only when SCHEDULER_ENABLED=1, so nothing
 * changes until the migration and the cron are set up.
 */

export const INLINE_MAX_DELAY_S = 5
export const MESSAGING_WINDOW_MS = 24 * 60 * 60 * 1000

export function schedulerEnabled() {
  return process.env.SCHEDULER_ENABLED === "1"
}

export interface GraphSendResult {
  ok: boolean
  messageId?: string
  status?: number
  error?: MetaError | null
  networkError?: boolean
  attempts: number
}

/**
 * POSTs one message to the Instagram Graph API with retry for transient errors only
 * (429, 5xx, network, Meta rate-limit codes). Permanent errors return immediately.
 * Used by sendSteps and by the scheduler's stored-failure retry.
 * The token only travels in the request URL and is never logged.
 */
export async function postGraphMessage(
  accessToken: string,
  apiBody: unknown,
  opts: { maxAttempts?: number } = {},
): Promise<GraphSendResult> {
  const r = await withRetry<{ messageId?: string }>(
    async () => {
      try {
        const res = await fetch(
          `https://graph.instagram.com/v24.0/me/messages?access_token=${encodeURIComponent(accessToken)}`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(apiBody) },
        )
        const json: any = await res.json().catch(() => ({}))
        const retryAfter = Number(res.headers.get("retry-after"))
        if (json?.error || !res.ok) {
          return {
            ok: false,
            status: res.status,
            error: (json?.error as MetaError) ?? { message: `HTTP ${res.status}` },
            retryAfterSec: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
          }
        }
        return { ok: true, value: { messageId: json.message_id }, status: res.status }
      } catch {
        return { ok: false, networkError: true }
      }
    },
    { maxAttempts: opts.maxAttempts ?? 3 },
  )
  return {
    ok: r.outcome.ok,
    messageId: r.outcome.value?.messageId,
    status: r.outcome.status,
    error: r.outcome.error,
    networkError: r.outcome.networkError,
    attempts: r.attempts,
  }
}

export type SendResult = { text: string; ok: boolean; messageId?: string; error?: string }

export type SendCtx = {
  userId: number
  /** Latest time a delayed send may still go out (Meta 24h window). Default: now + 24h. */
  windowUntil?: Date
}

export async function enqueueJob(
  ctx: SendCtx,
  job: { kind: "steps" | "flow"; psid: string; payload: any; delaySeconds: number },
): Promise<boolean> {
  const supabase = await getSupabaseServerClient()
  const now = Date.now()
  const runAt = new Date(now + job.delaySeconds * 1000)
  const expires = ctx.windowUntil ?? new Date(now + MESSAGING_WINDOW_MS)
  if (runAt.getTime() > expires.getTime()) return false // would land outside the window — don't queue
  const { error } = await supabase.from("scheduled_messages").insert({
    user_id: ctx.userId,
    kind: job.kind,
    psid: job.psid,
    payload: job.payload,
    run_at: runAt.toISOString(),
    expires_at: expires.toISOString(),
  })
  if (error) {
    console.error("[scheduler] enqueue failed:", error)
    return false
  }
  return true
}

/**
 * Sends a response as one or more sequential DM steps.
 * firstRecipient is { comment_id } for a comment private reply, or { id: psid } otherwise.
 * Every step after the first always targets psid.
 */
export async function sendSteps(
  accessToken: string,
  firstRecipient: any,
  psid: string,
  content: any,
  ctx?: SendCtx,
): Promise<{ ok: boolean; results: SendResult[]; scheduled?: boolean }> {
  const steps: any[] =
    Array.isArray(content.steps) && content.steps.length > 0
      ? content.steps
      : [{ text: content.message, card: content.card, delay_seconds: content.delay_seconds }]

  const results: SendResult[] = []
  let allOk = true

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    const delay = step.delay_seconds || 0

    if (delay > INLINE_MAX_DELAY_S && ctx && schedulerEnabled()) {
      // Hand the rest of the sequence to the cron; the delay is consumed by run_at.
      const rest = steps.slice(i).map((s, idx) => (idx === 0 ? { ...s, delay_seconds: 0 } : s))
      const queued = await enqueueJob(ctx, {
        kind: "steps",
        psid,
        payload: { steps: rest, firstRecipient: i === 0 ? firstRecipient : { id: psid } },
        delaySeconds: delay,
      })
      if (queued) return { ok: allOk, results, scheduled: true }
      console.warn("[scheduler] could not queue, falling back to inline wait")
    }
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay * 1000))

    const apiBody: any = { recipient: i === 0 ? firstRecipient : { id: psid } }
    let textLog = ""

    // Without an account context a {link:..} token cannot be resolved, so strip it rather than send it raw.
    const expand = async (t: string | undefined | null) =>
      !t ? "" : ctx ? expandLinksForUser(ctx.userId, t) : expandTokens(t, new Map())
    if (step.card) {
      const card = step.card
      const apiButtons = await Promise.all(card.buttons.map(async (b: any) => ({
        type: b.type,
        title: b.title,
        url: b.url ? await expand(b.url) : undefined,
        payload: b.payload || undefined,
      })))
      const element: any = { title: card.title, buttons: apiButtons }
      if (card.subtitle) element.subtitle = card.subtitle
      if (card.image_url && card.image_url.startsWith("http")) element.image_url = card.image_url
      apiBody.message = { attachment: { type: "template", payload: { template_type: "generic", elements: [element] } } }
      textLog = `[Card] ${card.title}`
    } else {
      const finalText = await expand(step.text)
      apiBody.message = { text: finalText }
      textLog = finalText
    }

    // Retry transient Meta errors briefly inline (webhook stays fast: ~2s worst case), permanent ones fail at once.
    const sent = await postGraphMessage(accessToken, apiBody)
    if (!sent.ok) {
      const errText = sent.networkError ? "Network error talking to Instagram" : JSON.stringify(sent.error)
      console.error(`[v0] 🔴 Step ${i + 1}/${steps.length} send failed after ${sent.attempts} attempt(s):`, sent.networkError ? "network" : errText)
      results.push({ text: textLog, ok: false, error: errText })
      allOk = false
      // Persist it so the creator sees it and transient failures are retried by the scheduler.
      if (ctx) {
        const cls = classifyFailure({ status: sent.status, error: sent.error, networkError: sent.networkError })
        // Private replies to a comment live 7 days; plain DMs only inside the 24h window.
        const isPrivateReply = i === 0 && !!(firstRecipient && firstRecipient.comment_id)
        const windowUntil = ctx.windowUntil ?? new Date(Date.now() + (isPrivateReply ? PRIVATE_REPLY_WINDOW_MS : DM_WINDOW_MS))
        await recordFailedSend({
          userId: ctx.userId,
          recipient: apiBody.recipient,
          psid,
          apiBody,
          restSteps: steps.slice(i + 1),
          preview: textLog,
          classification: cls,
          errorCode: sent.error?.code,
          errorSubcode: sent.error?.error_subcode,
          errorMessage: sent.error?.message,
          windowUntil,
        })
      }
      break // stop the sequence on first failure — don't send later steps out of order
    }
    results.push({ text: textLog, ok: true, messageId: sent.messageId })
  }

  return { ok: allOk, results }
}

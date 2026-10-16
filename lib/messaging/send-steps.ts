import { getSupabaseServerClient } from "@/lib/supabase-server"
import { expandLinksForUser } from "@/lib/links/store"
import { expandTokens } from "@/lib/links/core"

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

    try {
      const res = await fetch(
        `https://graph.instagram.com/v24.0/me/messages?access_token=${encodeURIComponent(accessToken)}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(apiBody) },
      )
      const json = await res.json()
      if (json.error) {
        console.error(`[v0] 🔴 Step ${i + 1}/${steps.length} send failed:`, JSON.stringify(json.error))
        results.push({ text: textLog, ok: false, error: JSON.stringify(json.error) })
        allOk = false
        break // stop the sequence on first failure — don't send later steps out of order
      }
      results.push({ text: textLog, ok: true, messageId: json.message_id })
    } catch (e) {
      console.error(`[v0] 🔴 Step ${i + 1}/${steps.length} network error:`, e)
      results.push({ text: textLog, ok: false, error: String(e) })
      allOk = false
      break
    }
  }

  return { ok: allOk, results }
}

/**
 * Retries stored transient DM failures.
 *
 * Who calls this: processDueMessages' caller, app/api/cron/process-scheduled (every scheduler run).
 * Why it exists: inline retries only cover a couple of seconds; Meta rate limits and outages last
 * minutes. This picks up 'open' failed_sends rows on a backoff schedule while the Meta window
 * (24h DM, 7d private reply) is still open, and gives up cleanly afterwards.
 */
import { rawQuery, getSupabaseServerClient } from "@/lib/supabase-server"
import { postGraphMessage, enqueueJob, type SendCtx } from "@/lib/messaging/send-steps"
import { MAX_STORED_ATTEMPTS, classifyFailure, storedRetryDelayMinutes } from "@/lib/messaging/retry"

interface Row {
  id: number
  user_id: number
  psid: string | null
  api_body: any
  rest_steps: any[] | null
  attempts: number
  window_until: string
}

export async function retryFailedSends(limit = 20) {
  const summary = { claimed: 0, recovered: 0, requeued: 0, dead: 0, expired: 0 }
  let rows: Row[] = []
  try {
    // Claim by pushing next_retry_at forward 10 min so two overlapping runs do not double-send.
    rows = await rawQuery<Row>(
      `UPDATE failed_sends SET next_retry_at = now() + interval '10 minutes'
        WHERE id IN (SELECT id FROM failed_sends WHERE status='open' AND next_retry_at <= now()
                      ORDER BY next_retry_at LIMIT $1 FOR UPDATE SKIP LOCKED)
        RETURNING id, user_id, psid, api_body, rest_steps, attempts, window_until`,
      [limit],
    )
  } catch {
    return summary // table missing (migration 26 not run): nothing to do
  }
  summary.claimed = rows.length
  const supabase = await getSupabaseServerClient()

  for (const row of rows) {
    // Meta window closed: sending now would be rejected (or look spammy). Stop for good.
    if (new Date(row.window_until).getTime() < Date.now()) {
      await rawQuery(`UPDATE failed_sends SET status='expired', next_retry_at=NULL, updated_at=now() WHERE id=$1`, [row.id])
      summary.expired++
      continue
    }
    const { data: user } = await supabase.from("users").select("access_token").eq("id", row.user_id).single()
    if (!user?.access_token || user.access_token === "REVOKED") {
      await rawQuery(`UPDATE failed_sends SET status='dead', reason='token', next_retry_at=NULL, updated_at=now() WHERE id=$1`, [row.id])
      summary.dead++
      continue
    }

    // One attempt per run; the backoff schedule between runs replaces inline waiting.
    const r = await postGraphMessage(user.access_token, row.api_body, { maxAttempts: 1 })
    const attempts = row.attempts + 1
    if (r.ok) {
      await rawQuery(`UPDATE failed_sends SET status='recovered', attempts=$2, next_retry_at=NULL, updated_at=now() WHERE id=$1`, [row.id, attempts])
      summary.recovered++
      // Resume the rest of the sequence that was stopped by the failure.
      if (row.rest_steps?.length && row.psid) {
        const ctx: SendCtx = { userId: row.user_id, windowUntil: new Date(row.window_until) }
        const ok = await enqueueJob(ctx, { kind: "steps", psid: row.psid, payload: { steps: row.rest_steps, firstRecipient: { id: row.psid } }, delaySeconds: 0 })
        if (ok) summary.requeued++
      }
      continue
    }
    const cls = classifyFailure({ status: r.status, error: r.error, networkError: r.networkError })
    const delay = storedRetryDelayMinutes(attempts)
    if (cls.kind === "permanent" || delay === null || attempts >= MAX_STORED_ATTEMPTS) {
      await rawQuery(
        `UPDATE failed_sends SET status='dead', failure_kind=$2, reason=$3, attempts=$4, next_retry_at=NULL, updated_at=now() WHERE id=$1`,
        [row.id, cls.kind, cls.reason, attempts],
      )
      summary.dead++
    } else {
      await rawQuery(
        `UPDATE failed_sends SET attempts=$2, reason=$3, next_retry_at = now() + ($4 || ' minutes')::interval, updated_at=now() WHERE id=$1`,
        [row.id, attempts, cls.reason, String(delay)],
      )
    }
  }
  return summary
}

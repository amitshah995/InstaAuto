/**
 * Persistent record of DMs that failed to send.
 *
 * Who calls this: lib/messaging/send-steps.ts (writes a row when a send ultimately fails),
 * app/api/dashboard/send-health (reads the counters), lib/messaging/retry-failed.ts (retries).
 * Why it exists: before, a failed DM was only a console line, so creators never learned about it
 * and transient Meta hiccups lost leads. This table makes failures visible and retryable.
 *
 * Never writes an access token. Degrades quietly if migration 26 has not been run.
 */
import { rawQuery } from "@/lib/supabase-server"
import { type Classification, storedRetryDelayMinutes } from "@/lib/messaging/retry"

/** Private replies to a comment are allowed for 7 days; every other DM only inside the 24h window. */
export const PRIVATE_REPLY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
export const DM_WINDOW_MS = 24 * 60 * 60 * 1000

export interface FailedSendInput {
  userId: number
  recipient: Record<string, unknown>
  psid: string
  apiBody: unknown
  restSteps?: unknown[]
  preview: string
  classification: Classification
  errorCode?: number
  errorSubcode?: number
  errorMessage?: string
  /** Latest time a retry may still go out. */
  windowUntil: Date
  source?: "dm" | "scheduled" | "retry"
}

/** Stores one failed send. Never throws: failure bookkeeping must not break the send path. */
export async function recordFailedSend(f: FailedSendInput): Promise<void> {
  try {
    const transient = f.classification.kind === "transient"
    const delayMin = storedRetryDelayMinutes(1)
    await rawQuery(
      `INSERT INTO failed_sends
         (user_id, source, recipient, psid, api_body, rest_steps, preview, failure_kind, reason,
          error_code, error_subcode, error_message, status, next_retry_at, window_until)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        f.userId,
        f.source ?? "dm",
        JSON.stringify(f.recipient),
        f.psid,
        JSON.stringify(f.apiBody),
        f.restSteps?.length ? JSON.stringify(f.restSteps) : null,
        f.preview.slice(0, 200),
        f.classification.kind,
        f.classification.reason,
        f.errorCode ?? null,
        f.errorSubcode ?? null,
        (f.errorMessage || "").slice(0, 500) || null,
        // Permanent errors are stored as 'dead' so they show up in the counter but are never retried.
        transient ? "open" : "dead",
        transient && delayMin ? new Date(Date.now() + delayMin * 60_000).toISOString() : null,
        f.windowUntil.toISOString(),
      ],
    )
  } catch (e) {
    console.error("[failed-sends] could not record failure (is migration 26 run?):", (e as Error)?.message)
  }
}

export interface SendHealth {
  failedLast24h: number
  retrying: number
  needsAttention: number
  recent: Array<{ id: number; preview: string; reason: string | null; status: string; created_at: string }>
}

/** Numbers for the dashboard alert. Returns zeros when the table is missing. */
export async function getSendHealth(userId: string | number): Promise<SendHealth> {
  try {
    const [c] = await rawQuery<{ failed24: number; retrying: number; dead: number }>(
      `SELECT
         COUNT(*) FILTER (WHERE status <> 'dismissed' AND created_at > now() - interval '24 hours')::int AS failed24,
         COUNT(*) FILTER (WHERE status = 'open')::int AS retrying,
         COUNT(*) FILTER (WHERE status IN ('dead','expired') AND created_at > now() - interval '7 days')::int AS dead
       FROM failed_sends WHERE user_id = $1`,
      [userId],
    )
    const recent = await rawQuery<SendHealth["recent"][number]>(
      `SELECT id, preview, reason, status, created_at FROM failed_sends
        WHERE user_id = $1 AND status <> 'dismissed' ORDER BY created_at DESC LIMIT 5`,
      [userId],
    )
    return { failedLast24h: c?.failed24 ?? 0, retrying: c?.retrying ?? 0, needsAttention: c?.dead ?? 0, recent }
  } catch {
    return { failedLast24h: 0, retrying: 0, needsAttention: 0, recent: [] }
  }
}

/** Lets the owner clear the alert once they have looked at it. */
export async function dismissFailedSends(userId: string | number): Promise<void> {
  await rawQuery(
    `UPDATE failed_sends SET status = 'dismissed', updated_at = now()
      WHERE user_id = $1 AND status IN ('dead','expired','open')`,
    [userId],
  )
}

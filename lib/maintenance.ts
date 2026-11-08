/**
 * Data-hygiene jobs that piggy-back on the scheduler endpoint.
 *
 * Who calls this: app/api/cron/process-scheduled on every run.
 * Why it exists: webhook_events stores the raw Meta payload of every event (usernames, comment
 * text, message text = personal data). Keeping it forever is a privacy and storage liability, so
 * rows older than WEBHOOK_RETENTION_DAYS (default 30) are deleted in small batches.
 */
import { rawQuery } from "@/lib/supabase-server"
import { retentionDays } from "@/lib/retention-days"

const BATCH = 2000

export async function runRetention() {
  const days = retentionDays()
  const out = { webhookEventsDeleted: 0, failedSendsDeleted: 0, days }
  try {
    // Batched so one run never holds a long lock; repeated runs finish the backlog.
    const r = await rawQuery<{ n: number }>(
      `WITH d AS (
         DELETE FROM webhook_events WHERE id IN (
           SELECT id FROM webhook_events WHERE processed_at < now() - ($1 || ' days')::interval LIMIT ${BATCH})
         RETURNING 1)
       SELECT COUNT(*)::int AS n FROM d`,
      [String(days)],
    )
    out.webhookEventsDeleted = r[0]?.n ?? 0
  } catch (e) {
    console.error("[maintenance] webhook_events cleanup failed:", (e as Error)?.message)
  }
  try {
    // Resolved failure records are also personal data (message text); keep them the same period.
    const r = await rawQuery<{ n: number }>(
      `WITH d AS (
         DELETE FROM failed_sends WHERE id IN (
           SELECT id FROM failed_sends WHERE status <> 'open' AND created_at < now() - ($1 || ' days')::interval LIMIT ${BATCH})
         RETURNING 1)
       SELECT COUNT(*)::int AS n FROM d`,
      [String(days)],
    )
    out.failedSendsDeleted = r[0]?.n ?? 0
  } catch {
    // table missing until migration 26 is run: not an error
  }
  return out
}

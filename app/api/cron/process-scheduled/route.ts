import { type NextRequest, NextResponse } from "next/server"
import { isServiceAuthorized } from "@/lib/security/service-auth"
import { processDueMessages } from "@/lib/messaging/scheduler"
import { retryFailedSends } from "@/lib/messaging/retry-failed"
import { processDueDeliveries } from "@/lib/webhooks/events"
import { runRetention } from "@/lib/maintenance"

export const maxDuration = 60

/**
 * The one scheduler endpoint. Each call: sends delayed messages that are due, retries stored
 * transient DM failures, and runs data-retention cleanup. Call it every minute from an external
 * pinger (cron-job.org) or Vercel Cron on Pro; on Hobby the daily cron is only a safety net.
 * See docs/SCHEDULER.md.
 *   GET /api/cron/process-scheduled   with   Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: NextRequest) {
  if (!isServiceAuthorized(request.headers)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    // Each stage is isolated: one failing stage must not stop the others.
    const messages = await processDueMessages()
    const retries = await retryFailedSends().catch((e) => ({ error: String(e?.message || e) }))
    const webhooks = await processDueDeliveries().catch((e) => ({ error: String(e?.message || e) }))
    const retention = await runRetention().catch((e) => ({ error: String(e?.message || e) }))
    // Spread keeps the old top-level shape (claimed/sent/failed/expired) for existing callers.
    return NextResponse.json({ ...messages, retries, webhooks, retention })
  } catch (e: any) {
    console.error("[scheduler] run failed:", e)
    return NextResponse.json({ error: "Scheduler failed" }, { status: 500 })
  }
}

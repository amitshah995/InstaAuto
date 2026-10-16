import { type NextRequest, NextResponse } from "next/server"
import { processDueMessages } from "@/lib/messaging/scheduler"

export const maxDuration = 60

/**
 * Sends delayed messages that are due. Call every minute from an external cron
 * (e.g. cron-job.org) or Vercel Cron on a Pro plan:
 *   GET /api/cron/process-scheduled   with   Authorization: Bearer <CRON_SECRET or API_SECRET_KEY>
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization")
  const ok =
    (process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`) ||
    (process.env.API_SECRET_KEY && auth === `Bearer ${process.env.API_SECRET_KEY}`)
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    return NextResponse.json(await processDueMessages())
  } catch (e: any) {
    console.error("[scheduler] run failed:", e)
    return NextResponse.json({ error: "Scheduler failed" }, { status: 500 })
  }
}

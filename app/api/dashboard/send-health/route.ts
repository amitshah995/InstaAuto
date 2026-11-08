/**
 * GET  /api/dashboard/send-health  -> counters for failed DMs (last 24h, retrying, needing attention)
 * POST /api/dashboard/send-health  -> { action: "dismiss" } clears the alert for this account
 *
 * Who calls this: components/dashboard/SendHealthBanner.tsx (shown on every dashboard page).
 * Why: creators must learn that DMs are failing instead of finding out from angry followers.
 */
import { type NextRequest, NextResponse } from "next/server"
import { authorizeUser } from "@/lib/auth"
import { dismissFailedSends, getSendHealth } from "@/lib/messaging/failed-sends"

export async function GET(request: NextRequest) {
  const auth = authorizeUser(request, request.nextUrl.searchParams.get("userId"))
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  return NextResponse.json(await getSendHealth(auth.userId))
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const auth = authorizeUser(request, body?.userId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (body?.action !== "dismiss") return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  await dismissFailedSends(auth.userId)
  return NextResponse.json({ ok: true })
}

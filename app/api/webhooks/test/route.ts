/**
 * POST /api/webhooks/test  { id }
 * Sends one signed test event to the endpoint right now and returns the result.
 * Who calls it: the "Send test" button in components/dashboard/WebhooksPanel.tsx.
 */
import { type NextRequest, NextResponse } from "next/server"
import { authorizeUser } from "@/lib/auth"
import { sendTest } from "@/lib/webhooks/events"

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const auth = authorizeUser(request, body?.userId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const id = Number(body?.id)
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Missing id" }, { status: 400 })
  try {
    return NextResponse.json(await sendTest(auth.userId, id))
  } catch (e) {
    console.error("[webhooks] test failed:", (e as Error)?.message)
    return NextResponse.json({ ok: false, error: "Could not send the test (is migration 28 run?)" }, { status: 500 })
  }
}

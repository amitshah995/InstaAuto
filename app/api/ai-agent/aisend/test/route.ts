/**
 * POST /api/ai-agent/aisend/test: "Send test lead". Delivers one clearly labelled test lead (email only, consent false,
 * never a phone number) to the saved AiSend address through the normal signed/SSRF-guarded sender, once, no retries.
 * Who calls it: components/ai-agent/ConnectorCard.tsx.
 */
import { type NextRequest, NextResponse } from "next/server"
import { rawQuery } from "@/lib/supabase-server"
import { agentUser, failure } from "@/lib/agent/api"
import { createAgentStore } from "@/lib/agent/store"
import { sendTest } from "@/lib/webhooks/events"

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const u = agentUser(request, body?.userId)
  if (!u.ok) return u.res
  try {
    const c = await createAgentStore(rawQuery).getConnector(u.userId)
    if (!c) return NextResponse.json({ error: "Save your AiSend address and key first." }, { status: 400 })
    const r = await sendTest(u.userId, Number(c.id))
    return NextResponse.json({ ok: r.ok, status: r.status ?? null, error: r.ok ? null : r.status === 401 ? "AiSend rejected the API key." : r.error || "AiSend did not accept the test lead." })
  } catch (e) {
    return failure("aisend test", e)
  }
}

/**
 * POST /api/ai-agent/test { mediaId, message, state?, history? } -> one simulated agent turn with a fake sender.
 * No Instagram message is sent, no contact is created or changed, no lead is dispatched. The browser keeps `state` and
 * `history` between turns. Uses the same engine, the same rate guard and the same daily agent counter as live chats.
 * Who calls it: components/ai-agent/TestPanel.tsx.
 */
import { NextResponse, type NextRequest } from "next/server"
import { rawQuery } from "@/lib/supabase-server"
import { agentUser, failure } from "@/lib/agent/api"
import { runSimulation } from "@/lib/agent/runtime"
import { agentEnabled, parseState } from "@/lib/agent/engine"
import { cleanUntrusted } from "@/lib/agent/injection"

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const u = agentUser(request, body?.userId)
  if (!u.ok) return u.res
  if (!agentEnabled()) return NextResponse.json({ error: "The AI model is not configured on this server." }, { status: 503 })
  const message = cleanUntrusted(body?.message, 1000)
  if (!message) return NextResponse.json({ error: "Type a message." }, { status: 400 })
  const mediaId = typeof body?.mediaId === "string" && /^\d{5,40}$/.test(body.mediaId) ? body.mediaId : null
  const history = (Array.isArray(body?.history) ? body.history : [])
    .slice(-12)
    .filter((h: any) => h && (h.role === "user" || h.role === "assistant") && typeof h.text === "string")
    .map((h: any) => ({ role: h.role, text: h.text.slice(0, 1000) }))
  try {
    const [user] = await rawQuery<any>(`SELECT id, username, ai_context FROM users WHERE id = $1`, [u.userId])
    if (!user) return NextResponse.json({ error: "Account not found" }, { status: 404 })
    const r = await runSimulation(user, mediaId, parseState(body?.state), history, message)
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
    const t = r.turn
    return NextResponse.json({
      reply: t.reply,
      state: t.state,
      // What WOULD have happened. Numbers and emails are masked: this is a rehearsal, nothing was stored or sent.
      wouldDo: t.effects.map((e) =>
        e.type === "phone_captured" ? { type: e.type, consented: e.consented, note: e.consented ? "Would be saved and sent to AiSend" : "Would be saved as unverified and NOT sent" }
        : e.type === "email_captured" ? { type: e.type, consented: e.consented, note: e.consented ? "Would be saved and sent to AiSend" : "Would be saved, not sent (no consent)" }
        : e.type === "handoff" ? { type: e.type, note: `Would hand over to a human (${e.reason})` }
        : { type: e.type, note: "Conversation would end" }),
      injectionSuspected: t.injectionSuspected,
      // Which knowledge was used for this reply (titles only, no text).
      retrieval: t.retrieval ?? null,
    })
  } catch (e) {
    return failure("test", e)
  }
}

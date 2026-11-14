/**
 * /api/ai-agent/conversations: read the agent's chats and take one over.
 *  GET            -> list of agent conversations
 *  GET ?igsid=... -> the messages of that person (only if they belong to the session user)
 *  POST { igsid } -> "Take over": sets human_handled and closes the agent conversation (the bot goes silent)
 * Who calls it: the Conversations tab.
 */
import { NextResponse, type NextRequest } from "next/server"
import { rawQuery } from "@/lib/supabase-server"
import { agentUser, failure } from "@/lib/agent/api"
import { createAgentStore } from "@/lib/agent/store"

export async function GET(request: NextRequest) {
  const u = agentUser(request)
  if (!u.ok) return u.res
  try {
    const store = createAgentStore(rawQuery)
    const igsid = request.nextUrl.searchParams.get("igsid")
    if (igsid) {
      const rows = await store.getMessages(u.userId, igsid, 80)
      return NextResponse.json({ messages: rows.reverse().map((m: any) => ({ text: m.content, fromPerson: m.is_from_instagram === true, at: m.created_at })) })
    }
    const rows = await store.listConversations(u.userId, 100)
    return NextResponse.json({
      conversations: rows.map((c: any) => ({ igsid: c.igsid, username: c.recipient_username ?? null, mediaId: c.media_id, status: c.status, turns: Number(c.turn_count) || 0, humanHandled: c.human_handled === true, startedAt: c.started_at, updatedAt: c.updated_at })),
    })
  } catch (e) {
    return failure("conversations GET", e)
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const u = agentUser(request, body?.userId)
  if (!u.ok) return u.res
  const igsid = typeof body?.igsid === "string" ? body.igsid : ""
  if (!igsid) return NextResponse.json({ error: "Missing igsid" }, { status: 400 })
  try {
    await createAgentStore(rawQuery).takeOver(u.userId, igsid)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return failure("conversations POST", e)
  }
}

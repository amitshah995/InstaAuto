/**
 * POST /api/ai-agent/kb/reindex { id } -> rebuilds one source's chunks and vectors (Reel sources from the saved Reel knowledge,
 * documents from their stored text, pages by fetching the address again). 404 if the source is not the caller's.
 * Who calls it: the "Re-index" button in the Knowledge tab.
 */
import { type NextRequest, NextResponse } from "next/server"
import { rawQuery } from "@/lib/supabase-server"
import { agentUser, failure } from "@/lib/agent/api"
import { createAgentStore } from "@/lib/agent/store"
import { reindexSource } from "@/lib/agent/rag/service"

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const u = agentUser(request, body?.userId)
  if (!u.ok) return u.res
  const id = typeof body?.id === "string" ? body.id : ""
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Missing id" }, { status: 400 })
  try {
    const store = createAgentStore(rawQuery)
    const r = await reindexSource(u.userId, id, (mediaId) => store.getKnowledge(u.userId, mediaId))
    if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
    return NextResponse.json({ ok: true, result: r.result })
  } catch (e) {
    return failure("kb reindex", e)
  }
}

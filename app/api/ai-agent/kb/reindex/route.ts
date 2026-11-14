/**
 * POST /api/ai-agent/kb/reindex { id } -> rebuilds one source's chunks and vectors (Reel sources from the saved Reel knowledge,
 * documents from their stored text, pages by fetching the address again). 404 if the source is not the caller's.
 * Who calls it: the "Re-index" button in the Knowledge tab.
 */
import { type NextRequest, NextResponse } from "next/server"
import { rawQuery } from "@/lib/supabase-server"
import { agentUser, failure, rateAllowed, readJsonLimited, tooBigResponse, tooManyResponse } from "@/lib/agent/api"
import { createAgentStore } from "@/lib/agent/store"
import { reindexSource } from "@/lib/agent/rag/service"

export async function POST(request: NextRequest) {
  const read = await readJsonLimited(request, 10_000)
  if (read.tooBig) return tooBigResponse()
  const body = read.body
  const u = agentUser(request, body?.userId)
  if (!u.ok) return u.res
  const id = typeof body?.id === "string" ? body.id : ""
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return NextResponse.json({ error: "Missing id" }, { status: 400 })
  if (!rateAllowed(u.userId, "kb-reindex", 10)) return tooManyResponse() // each re-index may call the embeddings API and fetch a page
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

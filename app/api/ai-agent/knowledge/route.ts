/**
 * /api/ai-agent/knowledge: per-Reel knowledge the agent answers from.
 *  GET -> list | PUT { mediaId, title, caption, offer, faqs[], active } upsert | DELETE ?mediaId=
 * Who calls it: components/ai-agent/KnowledgeEditor.tsx. Every query is scoped to the session user (lib/agent/store.ts).
 */
import { type NextRequest, NextResponse } from "next/server"
import { rawQuery } from "@/lib/supabase-server"
import { agentUser, failure } from "@/lib/agent/api"
import { createAgentStore, sanitizeKnowledgeInput } from "@/lib/agent/store"
import { reindexReel, removeReel } from "@/lib/agent/rag/service"

export async function GET(request: NextRequest) {
  const u = agentUser(request)
  if (!u.ok) return u.res
  try {
    return NextResponse.json({ items: await createAgentStore(rawQuery).listKnowledge(u.userId) })
  } catch (e) {
    return failure("knowledge GET", e)
  }
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const u = agentUser(request, body?.userId)
  if (!u.ok) return u.res
  const k = sanitizeKnowledgeInput(body)
  if (!k) return NextResponse.json({ error: "Choose a Reel (a numeric media id is required)." }, { status: 400 })
  if (!k.offer && k.faqs.length === 0 && !k.caption) return NextResponse.json({ error: "Add at least a caption, an offer or one FAQ." }, { status: 400 })
  try {
    await createAgentStore(rawQuery).upsertKnowledge(u.userId, k, body?.active !== false)
    // Re-index this Reel's offer, caption and FAQs for retrieval (replace-all). The save has already succeeded: if indexing
    // fails (for example migration 32 is not run yet) the agent keeps answering from the whole knowledge, as before.
    let index: { status: string; chunks: number; embedded: number } | null = null
    try {
      const results = await reindexReel(u.userId, k)
      index = { status: results.every((r) => r.status === "ready") ? "ready" : "failed", chunks: results.reduce((n, r) => n + r.chunkCount, 0), embedded: results.reduce((n, r) => n + r.embeddedCount, 0) }
    } catch {
      index = null
    }
    return NextResponse.json({ ok: true, index })
  } catch (e) {
    return failure("knowledge PUT", e)
  }
}

export async function DELETE(request: NextRequest) {
  const u = agentUser(request)
  if (!u.ok) return u.res
  const mediaId = request.nextUrl.searchParams.get("mediaId") || ""
  if (!/^\d{5,40}$/.test(mediaId)) return NextResponse.json({ error: "Missing mediaId" }, { status: 400 })
  try {
    await createAgentStore(rawQuery).deleteKnowledge(u.userId, mediaId)
    await removeReel(u.userId, mediaId).catch(() => {}) // its indexed chunks go too (business-wide documents stay)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return failure("knowledge DELETE", e)
  }
}

/**
 * POST /api/ai-agent/kb/search { query, mediaId? } -> which chunks the agent WOULD use for that question.
 * No model call, no Instagram message, nothing stored. (The question's embedding, when a key is set, counts toward the daily
 * embedding counter like a live turn.) Who calls it: the "Search test" box in the Knowledge tab.
 */
import { type NextRequest, NextResponse } from "next/server"
import { agentUser, failure } from "@/lib/agent/api"
import { retrieverFor } from "@/lib/agent/rag/service"
import { cleanUntrusted } from "@/lib/agent/injection"

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const u = agentUser(request, body?.userId)
  if (!u.ok) return u.res
  const query = cleanUntrusted(body?.query, 300)
  if (!query) return NextResponse.json({ error: "Type a question." }, { status: 400 })
  const mediaId = typeof body?.mediaId === "string" && /^\d{5,40}$/.test(body.mediaId) ? body.mediaId : null
  try {
    const r = await retrieverFor(u.userId, mediaId)(query)
    return NextResponse.json({
      mode: r.mode, indexed: r.indexed, fallbackReason: r.fallbackReason, totalChars: r.totalChars, sourceTitles: r.sourceTitles,
      chunks: r.chunks.map((c) => ({ title: c.title, kind: c.sourceKind, scope: c.mediaId ? "this Reel" : "whole business", score: Math.round(c.score * 100) / 100, text: c.content.slice(0, 400) })),
    })
  } catch (e) {
    return failure("kb search", e)
  }
}

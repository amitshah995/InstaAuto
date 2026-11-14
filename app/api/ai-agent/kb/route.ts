/**
 * /api/ai-agent/kb: the knowledge base the agent searches (sources and their chunks).
 *  GET                  -> { sources[], embeddingConfigured, retrievalEnabled } (never the key, never chunk text)
 *  POST { kind: "document", title, body, mediaId? }  paste text (max 60,000 characters)
 *  POST { kind: "website", url, title?, mediaId? }   import ONE https page (SSRF-guarded)
 *  DELETE ?id=          -> remove a source and its chunks
 * mediaId absent/null = the whole business; a numeric id = that Reel only.
 * Who calls it: components/ai-agent/KnowledgeBase.tsx (Knowledge tab and Setup step 2). Everything is scoped to the session user.
 */
import { type NextRequest, NextResponse } from "next/server"
import { agentUser, failure, rateAllowed, readJsonLimited, tooBigResponse, tooManyResponse } from "@/lib/agent/api"
import { addDocument, hasEmbeddingKey, importWebsite, ragEnabled, ragStore } from "@/lib/agent/rag/service"
import { MAX_SOURCE_CHARS } from "@/lib/agent/rag/chunk"

const MAX_SOURCES = 100
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest) {
  const u = agentUser(request)
  if (!u.ok) return u.res
  try {
    const sources = await ragStore().listSources(u.userId)
    return NextResponse.json({ sources, embeddingConfigured: hasEmbeddingKey(), retrievalEnabled: ragEnabled() })
  } catch (e) {
    return failure("kb GET", e)
  }
}

export async function POST(request: NextRequest) {
  const read = await readJsonLimited(request, 700_000)
  if (read.tooBig) return tooBigResponse()
  const body = read.body
  const u = agentUser(request, body?.userId)
  if (!u.ok) return u.res
  const mediaId = body?.mediaId == null || body.mediaId === "" ? null : String(body.mediaId).trim()
  if (mediaId !== null && !/^\d{5,40}$/.test(mediaId)) return NextResponse.json({ error: "Choose a Reel or leave it for the whole business." }, { status: 400 })
  if (!rateAllowed(u.userId, "kb-add", 10)) return tooManyResponse() // each add may call the embeddings API and fetch a page
  try {
    const store = ragStore()
    if ((await store.listSources(u.userId)).filter((s) => s.kind === "document" || s.kind === "website").length >= MAX_SOURCES) {
      return NextResponse.json({ error: `You can add up to ${MAX_SOURCES} documents and pages. Delete one first.` }, { status: 400 })
    }
    if (body?.kind === "website") {
      const url = typeof body.url === "string" ? body.url.trim() : ""
      if (!url) return NextResponse.json({ error: "Enter the page address, for example https://example.com/offer" }, { status: 400 })
      const r = await importWebsite(u.userId, { url, title: typeof body.title === "string" ? body.title : undefined, mediaId })
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 })
      return NextResponse.json({ ok: true, result: r.result })
    }
    const title = typeof body?.title === "string" ? body.title.trim().slice(0, 120) : ""
    const text = typeof body?.body === "string" ? body.body : ""
    if (!title) return NextResponse.json({ error: "Give the document a title." }, { status: 400 })
    if (text.trim().length < 20) return NextResponse.json({ error: "Paste at least a few sentences." }, { status: 400 })
    if (text.length > MAX_SOURCE_CHARS) return NextResponse.json({ error: `That is too long. The limit is ${MAX_SOURCE_CHARS.toLocaleString("en-IN")} characters.` }, { status: 400 })
    return NextResponse.json({ ok: true, result: await addDocument(u.userId, { title, body: text, mediaId }) })
  } catch (e) {
    return failure("kb POST", e)
  }
}

export async function DELETE(request: NextRequest) {
  const u = agentUser(request)
  if (!u.ok) return u.res
  const id = request.nextUrl.searchParams.get("id") || ""
  if (!UUID.test(id)) return NextResponse.json({ error: "Missing id" }, { status: 400 })
  try {
    await ragStore().deleteSource(u.userId, id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return failure("kb DELETE", e)
  }
}

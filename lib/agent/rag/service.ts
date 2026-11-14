/**
 * Knowledge base service: the glue between the pure RAG pieces (chunk, ingest, retrieve) and the database, OpenAI and billing.
 *
 * Who calls this:
 *  - app/api/ai-agent/knowledge (Reel knowledge saved or deleted) -> reindexReel / removeReel
 *  - app/api/ai-agent/kb/* (documents, page import, re-index, delete, search test)
 *  - lib/agent/runtime.ts (live DMs and the Test panel) -> retrieverFor
 * Cost/latency choices: the query embedding has a 4s timeout and falls back to keyword search; embedding calls (one per turn,
 * one per 64 chunks on ingest) are counted in the daily "embed_day" counter (lib/billing/usage.ts reserveEmbedding), and when
 * that is exhausted the agent simply uses keyword search. AGENT_RAG=0 switches retrieval off (whole knowledge in the prompt).
 * Privacy: chunk text and queries are sent to OpenAI for embeddings. Nothing here logs text, keys or numbers.
 */
import { rawQuery } from "@/lib/supabase-server"
import { reserveEmbedding } from "@/lib/billing/usage"
import type { Knowledge } from "../types.ts"
import { chunkText, MAX_SOURCE_CHARS, planReelSources } from "./chunk.ts"
import { embedBatch, embedQuery, hasEmbeddingKey } from "./embed.ts"
import { fetchPageText } from "./fetch-page.ts"
import { ingestSource, type IngestDeps, type IngestResult } from "./ingest.ts"
import { retrieve, type Retrieval } from "./retrieve.ts"
import { createRagStore } from "./store.ts"

export const ragStore = () => createRagStore(rawQuery)
export const ragEnabled = () => process.env.AGENT_RAG !== "0"
export { hasEmbeddingKey }

const ingestDeps = (userId: string | number): IngestDeps => ({
  store: ragStore(),
  embed: (texts) => embedBatch(texts),
  hasKey: () => hasEmbeddingKey(),
  allowEmbedCall: async () => (await reserveEmbedding(userId)).allowed,
})

/** Re-indexes a Reel's offer, caption and FAQs (replace-all per source). Never throws; failures are reported per source. */
export async function reindexReel(userId: string | number, k: Knowledge): Promise<IngestResult[]> {
  const out: IngestResult[] = []
  for (const plan of planReelSources(k)) {
    out.push(await ingestSource(ingestDeps(userId), { userId, mediaId: k.mediaId, kind: plan.kind, title: plan.title, chunks: plan.chunks }))
  }
  return out
}

/** The Reel's knowledge was deleted: remove its offer/caption/FAQ chunks. Business-wide documents stay. */
export async function removeReel(userId: string | number, mediaId: string) {
  await ragStore().deleteReelSources(userId, mediaId)
}

/** Pasted document (title + body, at most 60,000 characters). mediaId null = business-wide. */
export async function addDocument(userId: string | number, d: { title: string; body: string; mediaId: string | null }) {
  const body = String(d.body ?? "").slice(0, MAX_SOURCE_CHARS)
  return ingestSource(ingestDeps(userId), { userId, mediaId: d.mediaId, kind: "document", title: d.title, rawText: body, chunks: chunkText(body) })
}

/** Imports ONE web page (https, public host) as a source. Returns an error message instead of throwing. */
export async function importWebsite(userId: string | number, d: { url: string; title?: string; mediaId: string | null; sourceId?: string }): Promise<{ ok: true; result: IngestResult } | { ok: false; error: string }> {
  const page = await fetchPageText(d.url)
  if (!page.ok) return { ok: false, error: page.error }
  const title = (d.title?.trim() || new URL(page.finalUrl).hostname).slice(0, 120)
  const result = await ingestSource(ingestDeps(userId), { userId, sourceId: d.sourceId, mediaId: d.mediaId, kind: "website", title, sourceUrl: d.url, chunks: chunkText(page.text) })
  return { ok: true, result }
}

/**
 * "Re-index" button. Reel sources are rebuilt from the saved Reel knowledge, documents from their stored text, pages are fetched
 * again. Returns null when the source does not belong to this account.
 */
export async function reindexSource(userId: string | number, sourceId: string, loadKnowledge: (mediaId: string) => Promise<Knowledge | null>): Promise<{ ok: true; result: IngestResult } | { ok: false; error: string } | null> {
  const store = ragStore()
  const src = await store.getSource(userId, sourceId)
  if (!src) return null
  if (src.kind === "website") {
    if (!src.sourceUrl) return { ok: false, error: "This source has no address to fetch." }
    return importWebsite(userId, { url: src.sourceUrl, title: src.title, mediaId: src.mediaId, sourceId })
  }
  if (src.kind === "document") {
    const body = src.rawText ?? ""
    return { ok: true, result: await ingestSource(ingestDeps(userId), { userId, sourceId, mediaId: src.mediaId, kind: "document", title: src.title, chunks: chunkText(body) }) }
  }
  const k = src.mediaId ? await loadKnowledge(src.mediaId) : null
  if (!k) return { ok: false, error: "The Reel knowledge for this source no longer exists." }
  const plan = planReelSources(k).find((p) => p.kind === src.kind)!
  return { ok: true, result: await ingestSource(ingestDeps(userId), { userId, sourceId, mediaId: k.mediaId, kind: plan.kind, title: plan.title, chunks: plan.chunks }) }
}

/**
 * Retrieval for one question. mediaId null = business-wide only (used when the Reel's knowledge is off or missing).
 * Embedding use is budgeted; over budget or on any failure it degrades to keyword search.
 */
export function retrieverFor(userId: string | number, mediaId: string | null) {
  return async (query: string): Promise<Retrieval> => {
    if (!ragEnabled()) return { mode: "none", indexed: false, chunks: [], totalChars: 0, sourceTitles: [], fallbackReason: "Retrieval is switched off" }
    return retrieve(
      {
        store: ragStore(),
        hasKey: () => hasEmbeddingKey(),
        embedQuery: async (text) => ((await reserveEmbedding(userId)).allowed ? embedQuery(text) : null),
        minSimilarity: Number(process.env.AGENT_RAG_MIN_SIMILARITY) > 0 ? Number(process.env.AGENT_RAG_MIN_SIMILARITY) : undefined,
      },
      { userId, mediaId, query },
    )
  }
}

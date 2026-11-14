/**
 * Retrieval: find the passages of the owner's knowledge that answer this turn's question.
 *
 * Who calls this: lib/agent/rag/service.ts (live DMs, the Test panel and the Knowledge tab "Search test").
 * Flow: query -> (vector search when a key and embedded chunks exist) -> else/also keyword search -> selectChunks (at most 5
 * chunks, ~3000 characters). Always scoped to the account and to (this Reel or business-wide). Nothing relevant = empty list, so
 * the agent says it will connect a human. Never throws: any failure degrades to keywords, then to "nothing found".
 * Pure ranking/selection functions are exported for tests; the store and the embedder are injected.
 */
import { extractSearchTerms, termHits, toTsQuery } from "./keywords.ts"
import type { ChunkHit, RagStore } from "./store.ts"

export const MAX_CHUNKS = 5
export const MAX_CONTEXT_CHARS = 3000
/** Cosine similarity floor for text-embedding-3-small: relevant passages usually score 0.3+, unrelated ones 0.1-0.2. */
export const MIN_SIMILARITY = 0.28

export type RetrieveMode = "vector" | "keyword" | "none"

export interface RetrieveDeps {
  store: Pick<RagStore, "hasChunks" | "vectorSearch" | "keywordSearch">
  hasKey: () => boolean
  /** Embeds the query; null = unavailable (no key, timeout, quota). Must enforce its own short timeout. */
  embedQuery: (text: string) => Promise<number[] | null>
  minSimilarity?: number
}

export interface Retrieval {
  mode: RetrieveMode
  /** True when this account has any indexed chunk for this Reel (own or business-wide). False = nothing indexed yet. */
  indexed: boolean
  chunks: ChunkHit[]
  totalChars: number
  /** Distinct source titles of the chosen chunks, for debugging in the Search test. */
  sourceTitles: string[]
  /** Why the vector path was not used ("no key", "embedding unavailable", "no vector match"), for the Search test banner. */
  fallbackReason: string | null
}

const EMPTY: Retrieval = { mode: "none", indexed: false, chunks: [], totalChars: 0, sourceTitles: [], fallbackReason: null }

/**
 * Picks the final chunks: drops other accounts' rows (defence in depth), blanks and duplicates, keeps the order given
 * (best first), stops at `max` chunks or `maxChars` characters in total.
 */
export function selectChunks(hits: ChunkHit[], userId: string | number, opts: { max?: number; maxChars?: number } = {}): ChunkHit[] {
  const max = opts.max ?? MAX_CHUNKS
  const maxChars = opts.maxChars ?? MAX_CONTEXT_CHARS
  const seen = new Set<string>()
  const out: ChunkHit[] = []
  let total = 0
  for (const h of hits) {
    if (String(h.userId) !== String(userId)) continue
    if (!h.content.trim() || seen.has(h.id)) continue
    const remaining = maxChars - total
    if (remaining <= 0 || out.length >= max) break
    const content = Array.from(h.content).length > remaining ? Array.from(h.content).slice(0, remaining).join("") : h.content
    seen.add(h.id)
    out.push({ ...h, content })
    total += Array.from(content).length
  }
  return out
}

/**
 * Keyword ranking over candidate rows: score = share of the query terms found in the chunk. Needs at least 2 hits when the
 * query has 3+ terms (one shared word like "hair" should not make an unrelated chunk "relevant"), otherwise 1.
 */
export function rankKeywordHits(rows: ChunkHit[], terms: string[]): ChunkHit[] {
  if (terms.length === 0) return []
  const minHits = terms.length >= 3 ? 2 : 1
  return rows
    .map((r) => ({ r, hits: termHits(`${r.title} ${r.content}`, terms) }))
    .filter((x) => x.hits >= minHits)
    .sort((a, b) => b.hits - a.hits || b.r.score - a.r.score)
    .map((x) => ({ ...x.r, score: Math.min(1, x.hits / terms.length) }))
}

/** Retrieves for one question. mediaId null = business-wide chunks only. */
export async function retrieve(deps: RetrieveDeps, a: { userId: string | number; mediaId: string | null; query: string }): Promise<Retrieval> {
  const query = String(a.query ?? "").trim()
  try {
    const indexed = await deps.store.hasChunks(a.userId, a.mediaId)
    if (!indexed) return { ...EMPTY }
    if (!query) return { ...EMPTY, indexed }

    let fallbackReason: string | null = null
    if (!deps.hasKey()) fallbackReason = "No embedding key: using keyword search"
    else {
      const v = await deps.embedQuery(query)
      if (!v) fallbackReason = "Embedding unavailable: using keyword search"
      else {
        try {
          const hits = await deps.store.vectorSearch(a.userId, a.mediaId, v, MAX_CHUNKS * 2, deps.minSimilarity ?? MIN_SIMILARITY)
          const chosen = selectChunks(hits, a.userId)
          if (chosen.length > 0) return build("vector", indexed, chosen, null)
          fallbackReason = "No vector match: tried keywords"
        } catch {
          fallbackReason = "Vector search failed: using keyword search"
        }
      }
    }

    const terms = extractSearchTerms(query)
    const candidates = await deps.store.keywordSearch(a.userId, a.mediaId, toTsQuery(terms), 40)
    const chosen = selectChunks(rankKeywordHits(candidates, terms), a.userId)
    return build(chosen.length ? "keyword" : "none", indexed, chosen, fallbackReason)
  } catch {
    // Tables missing (migration 32 not run), database error: the agent falls back to its previous behaviour.
    return { ...EMPTY }
  }
}

function build(mode: RetrieveMode, indexed: boolean, chunks: ChunkHit[], fallbackReason: string | null): Retrieval {
  return {
    mode, indexed, chunks, fallbackReason,
    totalChars: chunks.reduce((n, c) => n + Array.from(c.content).length, 0),
    sourceTitles: [...new Set(chunks.map((c) => c.title).filter(Boolean))],
  }
}

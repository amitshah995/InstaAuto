/**
 * Ingest: turn chunks into stored, searchable rows for one source (replace-all).
 *
 * Who calls this: lib/agent/rag/service.ts (Reel knowledge saved, document pasted, page imported, "Re-index" pressed).
 * Why: one place decides the embedding behaviour: ONE batched embeddings call per 64 chunks, store the chunk WITHOUT a vector
 * when there is no key or the call fails (never lose it), count chunks vs embedded chunks, and record the outcome on the source
 * row so the dashboard can show it. Dependencies are injected, so tests run with a fake store and a fake embedder.
 */
import type { Chunk } from "./chunk.ts"
import { EMBED_BATCH_SIZE } from "./embed.ts"
import type { RagStore, SourceKind } from "./store.ts"

export interface IngestDeps {
  store: Pick<RagStore, "upsertSource" | "replaceChunks" | "setSourceStatus">
  /** Embeds up to EMBED_BATCH_SIZE texts in one call. Throws on failure. */
  embed: (texts: string[]) => Promise<number[][]>
  hasKey: () => boolean
  /** Optional daily budget check before each embeddings call; false = skip embedding (keyword-only chunks). */
  allowEmbedCall?: () => Promise<boolean>
}

export interface IngestInput {
  userId: string | number
  sourceId?: string
  mediaId: string | null
  kind: SourceKind
  title: string
  sourceUrl?: string | null
  rawText?: string | null
  chunks: Chunk[]
}

export interface IngestResult {
  sourceId: string
  status: "ready" | "failed"
  chunkCount: number
  embeddedCount: number
  /** Why vectors are missing, if any (shown to the owner). Never contains text or keys. */
  note: string | null
}

/**
 * Replaces everything stored for the source with `chunks`. Safe to run again with the same input: same rows, same counts.
 * Empty `chunks` clears the source (status ready, 0 chunks). Never throws; a storage error becomes status "failed".
 */
export async function ingestSource(deps: IngestDeps, input: IngestInput): Promise<IngestResult> {
  const { userId } = input
  let sourceId = ""
  try {
    sourceId = await deps.store.upsertSource(userId, { id: input.sourceId, mediaId: input.mediaId, kind: input.kind, title: input.title, sourceUrl: input.sourceUrl, rawText: input.rawText })

    // Embed first (outside the database), in batches. Any failure leaves those chunks with a null vector.
    const vectors: (number[] | null)[] = new Array(input.chunks.length).fill(null)
    let note: string | null = null
    if (input.chunks.length > 0) {
      if (!deps.hasKey()) {
        note = "No embedding key: stored for keyword search only"
      } else {
        for (let i = 0; i < input.chunks.length; i += EMBED_BATCH_SIZE) {
          const slice = input.chunks.slice(i, i + EMBED_BATCH_SIZE)
          if (deps.allowEmbedCall && !(await deps.allowEmbedCall())) {
            note = "Daily embedding limit reached: stored for keyword search only"
            break
          }
          try {
            const out = await deps.embed(slice.map((c) => c.content))
            if (out.length !== slice.length) throw new Error("embedding count mismatch")
            out.forEach((v, j) => { vectors[i + j] = v })
          } catch {
            note = "Embedding failed: stored for keyword search only"
          }
        }
      }
    }

    await deps.store.replaceChunks(userId, { id: sourceId, mediaId: input.mediaId, kind: input.kind, title: input.title }, input.chunks.map((c, i) => ({ ...c, embedding: vectors[i] })))
    const embeddedCount = vectors.filter((v) => v !== null).length
    await deps.store.setSourceStatus(userId, sourceId, { status: "ready", chunkCount: input.chunks.length, embeddedCount, error: note })
    return { sourceId, status: "ready", chunkCount: input.chunks.length, embeddedCount, note }
  } catch (e) {
    // The owner sees this text in the dashboard: never pass raw database errors (table, constraint or value names) through.
    const raw = String((e as Error)?.message || "")
    const msg = /agent_kb_|match_agent_chunks|type "vector"|extension/i.test(raw) ? "The knowledge base is not set up yet (run migration 32)." : "Indexing failed. Please try Re-index."
    console.error("[agent-rag] ingest failed", (e as any)?.code ? `code=${String((e as any).code).slice(0, 10)}` : "")
    if (sourceId) await deps.store.setSourceStatus(userId, sourceId, { status: "failed", chunkCount: 0, embeddedCount: 0, error: msg }).catch(() => {})
    return { sourceId, status: "failed", chunkCount: 0, embeddedCount: 0, note: msg }
  }
}

/**
 * Database access for the agent knowledge base (agent_kb_sources, agent_kb_chunks, match_agent_chunks).
 *
 * Who calls this: lib/agent/rag/service.ts (built with rawQuery) and the unit/real-SQL tests (built with fakes).
 * Tenant rule: EVERY statement filters on user_id = $1 and passes the user id as the first parameter; chunk writes also carry
 * the owner through the (source_id, user_id) foreign key. Row-level security is not relied on. tests/agent-rag.test.ts fails
 * if a statement is not scoped.
 * The query function is injected so the SQL can be checked without a database.
 */
import { toVectorLiteral } from "./embed.ts"
import type { Chunk } from "./chunk.ts"

export type QueryFn = <T = any>(text: string, values?: any[]) => Promise<T[]>

export type SourceKind = "reel_offer" | "reel_caption" | "reel_faq" | "document" | "website"
export type SourceStatus = "pending" | "ready" | "failed"

export interface SourceRow {
  id: string
  mediaId: string | null
  kind: SourceKind
  title: string
  sourceUrl: string | null
  status: SourceStatus
  chunkCount: number
  embeddedCount: number
  error: string | null
  updatedAt: string
}

/** A retrieved chunk. `score` is cosine similarity for vector hits and a keyword score (0..1) for keyword hits. */
export interface ChunkHit {
  id: string
  userId: string
  sourceId: string
  mediaId: string | null
  sourceKind: SourceKind
  title: string
  content: string
  chunkIndex: number
  score: number
  /** True when the chunk has no vector (its embedding call failed, was skipped or no key was set). Only keyword rows carry it. */
  noVector?: boolean
}

/** Postgres text cannot hold a NUL (\u0000): the whole statement fails with "invalid byte sequence". Strip it before it reaches SQL. */
const noNul = <T extends string | null | undefined>(s: T): T => (typeof s === "string" ? (s.replace(/\u0000/g, "") as T) : s)

const toSource = (r: any): SourceRow => ({
  id: r.id, mediaId: r.media_id ?? null, kind: r.kind, title: r.title ?? "", sourceUrl: r.source_url ?? null, status: r.status,
  chunkCount: Number(r.chunk_count) || 0, embeddedCount: Number(r.embedded_count) || 0, error: r.error ?? null, updatedAt: r.updated_at,
})
const toHit = (r: any, score: number): ChunkHit => ({
  id: r.id, userId: String(r.user_id), sourceId: r.source_id, mediaId: r.media_id ?? null, sourceKind: r.source_kind, title: r.title ?? "",
  content: r.content ?? "", chunkIndex: Number(r.chunk_index) || 0, score, noVector: r.no_vec === true,
})

export function createRagStore(q: QueryFn) {
  return {
    /** Creates the source, or (reel_* kinds, and any call with an id) updates it. Returns the source id. */
    async upsertSource(userId: string | number, s: { id?: string; mediaId: string | null; kind: SourceKind; title: string; sourceUrl?: string | null; rawText?: string | null }): Promise<string> {
      if (s.id) {
        const rows = await q(
          `UPDATE agent_kb_sources SET title=$3, source_url=$4, raw_text=COALESCE($5, raw_text), status='pending', error=NULL, updated_at=now()
            WHERE user_id = $1 AND id = $2 RETURNING id`,
          [userId, s.id, noNul(s.title), noNul(s.sourceUrl) ?? null, noNul(s.rawText) ?? null],
        )
        if (!rows[0]) throw new Error("Source not found")
        return rows[0].id
      }
      if (s.kind.startsWith("reel_")) {
        const rows = await q(
          `INSERT INTO agent_kb_sources (user_id, media_id, kind, title, status) VALUES ($1,$2,$3,$4,'pending')
           ON CONFLICT (user_id, media_id, kind) WHERE kind LIKE 'reel\\_%' DO UPDATE SET title=$4, status='pending', error=NULL, updated_at=now()
           RETURNING id`,
          [userId, s.mediaId, s.kind, noNul(s.title)],
        )
        return rows[0].id
      }
      const rows = await q(
        `INSERT INTO agent_kb_sources (user_id, media_id, kind, title, source_url, raw_text, status) VALUES ($1,$2,$3,$4,$5,$6,'pending') RETURNING id`,
        [userId, s.mediaId, s.kind, noNul(s.title), noNul(s.sourceUrl) ?? null, noNul(s.rawText) ?? null],
      )
      return rows[0].id
    },

    async getSource(userId: string | number, id: string): Promise<(SourceRow & { rawText: string | null }) | null> {
      const rows = await q(`SELECT * FROM agent_kb_sources WHERE user_id = $1 AND id = $2`, [userId, id])
      return rows[0] ? { ...toSource(rows[0]), rawText: rows[0].raw_text ?? null } : null
    },

    /** The account's sources, newest first. mediaId filters to that Reel's sources plus business-wide ones. */
    async listSources(userId: string | number, mediaId?: string | null): Promise<SourceRow[]> {
      const rows = mediaId
        ? await q(`SELECT * FROM agent_kb_sources WHERE user_id = $1 AND (media_id = $2 OR media_id IS NULL) ORDER BY updated_at DESC LIMIT 200`, [userId, mediaId])
        : await q(`SELECT * FROM agent_kb_sources WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 200`, [userId])
      return rows.map(toSource)
    },

    async deleteSource(userId: string | number, id: string) {
      await q(`DELETE FROM agent_kb_sources WHERE user_id = $1 AND id = $2`, [userId, id])
    },
    /** Removes a Reel's offer/caption/FAQ sources (chunks go with them). Business-wide sources are untouched. */
    async deleteReelSources(userId: string | number, mediaId: string) {
      await q(`DELETE FROM agent_kb_sources WHERE user_id = $1 AND media_id = $2 AND kind LIKE 'reel\\_%'`, [userId, mediaId])
    },

    async setSourceStatus(userId: string | number, id: string, s: { status: SourceStatus; chunkCount: number; embeddedCount: number; error?: string | null }) {
      await q(
        `UPDATE agent_kb_sources SET status=$3, chunk_count=$4, embedded_count=$5, error=$6, updated_at=now() WHERE user_id = $1 AND id = $2`,
        [userId, id, s.status, s.chunkCount, s.embeddedCount, s.error ? noNul(String(s.error)).slice(0, 300) : null],
      )
    },

    /**
     * Replace-all for one source in ONE statement (upsert the new chunks, delete the surplus old ones), so a crash or a concurrent search
     * never sees a half-replaced source. rows may be empty: then the source simply ends up with no chunks. A chunk whose embedding
     * is null is stored anyway (keyword search still finds it).
     */
    async replaceChunks(userId: string | number, src: { id: string; mediaId: string | null; kind: SourceKind; title: string }, rows: (Chunk & { embedding: number[] | null })[]) {
      if (rows.length === 0) {
        await q(`DELETE FROM agent_kb_chunks WHERE user_id = $1 AND source_id = $2`, [userId, src.id])
        return
      }
      // Upsert on (source_id, chunk_index), then delete the surplus (indexes >= rows.length). Two overlapping re-indexes of the same
      // source (double click, Reel saved while "Re-index" runs) used to DUPLICATE every chunk: "delete old + insert new" in one
      // statement cannot see the other statement's rows under READ COMMITTED. With the unique index the later writer overwrites the
      // earlier one's rows. The DO UPDATE guard keeps a conflicting row of ANOTHER account untouched.
      await q(
        `WITH up AS (
           INSERT INTO agent_kb_chunks (user_id, media_id, source_id, source_kind, title, content, chunk_index, token_estimate, embedding)
           SELECT $1, $3, $2, $4, $5, t.content, t.idx, t.tok, t.emb::vector
             FROM unnest($6::text[], $7::int[], $8::int[], $9::text[]) AS t(content, idx, tok, emb)
           ON CONFLICT (source_id, chunk_index) DO UPDATE
             SET media_id = EXCLUDED.media_id, source_kind = EXCLUDED.source_kind, title = EXCLUDED.title, content = EXCLUDED.content,
                 token_estimate = EXCLUDED.token_estimate, embedding = EXCLUDED.embedding
           WHERE agent_kb_chunks.user_id = EXCLUDED.user_id
           RETURNING 1
         )
         DELETE FROM agent_kb_chunks WHERE user_id = $1 AND source_id = $2 AND chunk_index >= $10::int`,
        [
          userId, src.id, src.mediaId, src.kind, noNul(src.title),
          rows.map((r) => noNul(r.content)), rows.map((_, i) => i), rows.map((r) => r.tokenEstimate),
          rows.map((r) => (r.embedding ? toVectorLiteral(r.embedding) : null)), rows.length,
        ],
      )
    },

    /** True when this account has any chunk visible to this Reel (its own or business-wide). */
    async hasChunks(userId: string | number, mediaId: string | null): Promise<boolean> {
      const rows = await q(
        `SELECT 1 AS x FROM agent_kb_chunks WHERE user_id = $1 AND (media_id IS NULL OR ($2::text IS NOT NULL AND media_id = $2)) LIMIT 1`,
        [userId, mediaId],
      )
      return rows.length > 0
    },

    /** Nearest chunks by cosine similarity (SQL function match_agent_chunks, which filters on user_id and media scope). */
    async vectorSearch(userId: string | number, mediaId: string | null, embedding: number[], count: number, minSimilarity: number): Promise<ChunkHit[]> {
      const rows = await q(`SELECT * FROM match_agent_chunks($1::bigint, $2::text, $3::vector, $4::int, $5::float)`, [userId, mediaId, toVectorLiteral(embedding), count, minSimilarity])
      return rows.map((r) => toHit(r, Number(r.similarity) || 0))
    },

    /** Candidate chunks that contain ANY of the terms (tsquery built by toTsQuery), best text rank first. Ranked again in code. */
    async keywordSearch(userId: string | number, mediaId: string | null, tsquery: string, limit: number): Promise<ChunkHit[]> {
      if (!tsquery) return []
      const rows = await q(
        `SELECT id, user_id, source_id, media_id, source_kind, title, content, chunk_index, ts_rank_cd(tsv, to_tsquery('simple', $3)) AS rank, (embedding IS NULL) AS no_vec
           FROM agent_kb_chunks
          WHERE user_id = $1 AND (media_id IS NULL OR ($2::text IS NOT NULL AND media_id = $2)) AND tsv @@ to_tsquery('simple', $3)
          ORDER BY rank DESC LIMIT $4`,
        [userId, mediaId, tsquery, Math.min(limit, 100)],
      )
      return rows.map((r) => toHit(r, Number(r.rank) || 0))
    },
  }
}

export type RagStore = ReturnType<typeof createRagStore>

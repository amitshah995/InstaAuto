// Real-SQL test for the RAG store and migration 32 (pgvector). Skipped unless QA_PG_HOST is set AND the database has the
// "vector" extension available with migration 32 applied (pgvector is NOT faked: without it this test is skipped).
import test from "node:test"
import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { createRagStore } from "../lib/agent/rag/store.ts"
import { ingestSource } from "../lib/agent/rag/ingest.ts"
import { retrieve } from "../lib/agent/rag/retrieve.ts"
import { chunkText } from "../lib/agent/rag/chunk.ts"
import { EMBEDDING_DIMENSIONS } from "../lib/agent/rag/embed.ts"

const host = process.env.QA_PG_HOST
const skip = host ? false : "set QA_PG_HOST (and QA_PG_PORT) with pgvector + migration 32 to run the real-SQL RAG tests"
const unit = (i: number) => Array.from({ length: EMBEDDING_DIMENSIONS }, (_, k) => (k === i ? 1 : 0))

test("real SQL (pgvector): tenant isolation incl. media_id collisions, vector + keyword search, replace-all", { skip }, async () => {
  const require = createRequire(import.meta.url)
  const { Pool } = require("pg")
  const pool = new Pool({ host, port: Number(process.env.QA_PG_PORT || 5432), user: process.env.QA_PG_USER || "postgres", database: process.env.QA_PG_DB || "qa" })
  const q = async (text: string, values: any[] = []) => (await pool.query(text, values)).rows
  const store = createRagStore(q as any)
  const A = 920001, B = 920002, M = "17900000000077"
  const embed = async (t: string[]) => t.map((x) => unit(x.includes("fees") ? 0 : 1))
  const d = { store, embed, hasKey: () => true }
  try {
    await q(`DELETE FROM agent_kb_sources WHERE user_id IN ($1,$2)`, [A, B])
    for (const [u, text] of [[A, "A: the session fees are Rs 5000."], [B, "B: the session fees are Rs 1."]] as const)
      await ingestSource(d, { userId: u, mediaId: M, kind: "document", title: `doc ${u}`, chunks: chunkText(text) })
    await ingestSource(d, { userId: A, mediaId: null, kind: "document", title: "brochure", chunks: chunkText("We are open every day.") })

    const ra = await retrieve({ store, hasKey: () => true, embedQuery: async () => unit(0) }, { userId: A, mediaId: M, query: "price" })
    assert.equal(ra.mode, "vector"); assert.ok(ra.chunks.length >= 1)
    assert.ok(ra.chunks.every((c) => String(c.userId) === String(A)) && ra.chunks[0].content.startsWith("A:"))
    const rb = await retrieve({ store, hasKey: () => false, embedQuery: async () => null }, { userId: B, mediaId: M, query: "fees" })
    assert.equal(rb.mode, "keyword"); assert.ok(rb.chunks.every((c) => c.content.startsWith("B:")))
    assert.equal((await store.listSources(A)).every((s: any) => s.id), true)
    assert.equal((await store.hasChunks(A, "other-media")), true) // business-wide chunk only
    // another tenant cannot touch/see A's source
    const [srcA] = await store.listSources(A)
    assert.equal(await store.getSource(B, srcA.id), null)
    await store.deleteSource(B, srcA.id); assert.ok(await store.getSource(A, srcA.id))
    // replace-all idempotency
    const again = await ingestSource(d, { userId: A, mediaId: M, kind: "reel_faq", title: "FAQs", chunks: chunkText("one. two. three.") })
    const again2 = await ingestSource(d, { userId: A, mediaId: M, kind: "reel_faq", title: "FAQs", chunks: chunkText("one. two. three.") })
    assert.equal(again.sourceId, again2.sourceId)
    assert.equal((await q(`SELECT count(*)::int AS n FROM agent_kb_chunks WHERE source_id = $1`, [again.sourceId]))[0].n, again2.chunkCount)
    await store.deleteSource(A, again.sourceId)
    assert.equal((await q(`SELECT count(*)::int AS n FROM agent_kb_chunks WHERE source_id = $1`, [again.sourceId]))[0].n, 0) // cascade
  } finally {
    await q(`DELETE FROM agent_kb_sources WHERE user_id IN ($1,$2)`, [A, B]).catch(() => {})
    await pool.end()
  }
})

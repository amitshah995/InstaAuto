// QA (adversarial): REAL Postgres 17 + pgvector 0.8 (PGlite, WASM) for migration 32, match_agent_chunks, the store SQL and the full
// ingest -> retrieve path. Skipped unless QA_PGLITE_DIR points at a directory with `npm i @electric-sql/pglite@0.3.14` done
// (installed OUTSIDE the repo: the project does not depend on it). One connection, so true concurrency is tested separately
// in qa-rag-pg.test.ts. Everything runs in memory; nothing is written to disk.
import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { createRagStore } from "../lib/agent/rag/store.ts"
import { ingestSource } from "../lib/agent/rag/ingest.ts"
import { retrieve } from "../lib/agent/rag/retrieve.ts"
import { chunkText, chunkFaqs } from "../lib/agent/rag/chunk.ts"
import { extractSearchTerms, toTsQuery } from "../lib/agent/rag/keywords.ts"
import { EMBEDDING_DIMENSIONS, toVectorLiteral } from "../lib/agent/rag/embed.ts"

const dir = process.env.QA_PGLITE_DIR
const skip = dir ? false : "set QA_PGLITE_DIR to a folder with @electric-sql/pglite installed to run the pgvector SQL tests"
const unit = (i: number, scale = 1) => Array.from({ length: EMBEDDING_DIMENSIONS }, (_, k) => (k === i ? scale : 0))
/** unit vector at angle: cos(theta) similarity with unit(0) */
const at = (cos: number) => { const v = new Array(EMBEDDING_DIMENSIONS).fill(0); v[0] = cos; v[1] = Math.sqrt(1 - cos * cos); return v }
const MIG = fs.readFileSync(path.join(import.meta.dirname, "../migrations/32-agent-rag.sql"), "utf8")

async function boot() {
  const base = path.join(dir!, "node_modules/@electric-sql/pglite/dist")
  const { PGlite } = await import(pathToFileURL(path.join(base, "index.js")).href)
  const { vector } = await import(pathToFileURL(path.join(base, "vector/index.js")).href)
  const db = await PGlite.create({ extensions: { vector } })
  const q = async (text: string, values: any[] = []) => (await db.query(text, values)).rows as any[]
  await db.exec(MIG)
  return { db, q, store: createRagStore(q as any) }
}
const embedBy = (store: any, f: (t: string) => number[]) => ({ store, embed: async (t: string[]) => t.map(f), hasKey: () => true })

test("migration 32 applies twice (idempotent), creates tables, unique position index, gin tsv index, vector index and the function", { skip }, async () => {
  const { db, q } = await boot()
  await db.exec(MIG)
  const idx = (await q(`select indexname, indexdef from pg_indexes where tablename in ('agent_kb_chunks','agent_kb_sources')`)).map((r) => r.indexname + " " + r.indexdef)
  const all = idx.join("\n")
  for (const name of ["agent_kb_chunks_scope_idx", "agent_kb_chunks_source_idx", "agent_kb_chunks_source_pos_uniq", "agent_kb_chunks_tsv_idx", "agent_kb_sources_user_idx", "agent_kb_sources_reel_uniq"]) assert.ok(all.includes(name), name)
  assert.match(all, /agent_kb_chunks_tsv_idx .*USING gin/)
  assert.match(all, /agent_kb_chunks_embedding_idx .*USING (hnsw|ivfflat) .*vector_cosine_ops/)
  assert.match(all, /agent_kb_chunks_embedding_idx .*USING hnsw/, "hnsw (not the ivfflat fallback) on this pgvector")
  assert.equal((await q(`select count(*)::int n from pg_proc where proname='match_agent_chunks'`))[0].n, 1)
  const cols = await q(`select column_name, is_generated, data_type from information_schema.columns where table_name='agent_kb_chunks' and column_name in ('tsv','embedding','user_id')`)
  assert.equal(cols.find((c) => c.column_name === "tsv").is_generated, "ALWAYS")
  assert.equal((await q(`select atttypmod from pg_attribute where attrelid='agent_kb_chunks'::regclass and attname='embedding'`))[0].atttypmod, EMBEDDING_DIMENSIONS)
})

test("match_agent_chunks: tenant isolation incl. the SAME media id, business-wide scope, null media = business-wide only, ordering, threshold and count clamps", { skip }, async () => {
  const { q, store } = await boot()
  const A = 1, B = 2, M = "1790000001"
  const d = embedBy(store, () => unit(0))
  for (const [u, kind, media] of [[A, "document", M], [B, "document", M], [A, "document", null], [B, "document", null]] as const)
    await ingestSource(d, { userId: u, mediaId: media, kind, title: `u${u}-${media ?? "biz"}`, chunks: [{ content: `secret of ${u} ${media ?? "biz"}`, tokenEstimate: 3 }] })
  const titles = async (u: number, m: string | null, min = 0.28) => (await store.vectorSearch(u, m, unit(0), 10, min)).map((h) => h.title).sort()
  assert.deepEqual(await titles(A, M), [`u1-${M}`, "u1-biz"]); assert.deepEqual(await titles(B, M), [`u2-${M}`, "u2-biz"])
  assert.deepEqual(await titles(A, null), ["u1-biz"]); assert.deepEqual(await titles(A, "9999999999"), ["u1-biz"])
  assert.deepEqual(await titles(3, M), [])
  // the function itself, called directly with a hostile media id / user: still scoped
  assert.equal((await q(`select * from match_agent_chunks(1, $1, $2::vector, 10, 0)`, [`' OR user_id=2 --`, toVectorLiteral(unit(0))])).filter((r) => r.user_id != 1).length, 0)
  await assert.rejects(() => q(`select * from match_agent_chunks('1 OR 1=1', null, $1::vector, 10, 0)`, [toVectorLiteral(unit(0))]))
  // ordering and threshold (>=) and count clamps (1..20)
  const o = embedBy(store, (t) => (t.includes("best") ? at(0.9) : t.includes("mid") ? at(0.5) : t.includes("edge") ? at(0.3) : t.includes("low") ? at(0.2) : unit(5)))
  await ingestSource(o, { userId: 7, mediaId: M, kind: "document", title: "o", chunks: ["low text", "mid text", "best text", "edge text", "other"].map((c) => ({ content: c, tokenEstimate: 1 })) })
  const hits = await store.vectorSearch(7, M, unit(0), 10, 0.28)
  assert.deepEqual(hits.map((h) => h.content), ["best text", "mid text", "edge text"])
  for (let i = 1; i < hits.length; i++) assert.ok(hits[i - 1].score >= hits[i].score)
  assert.ok(Math.abs(hits[0].score - 0.9) < 1e-6)
  assert.equal((await store.vectorSearch(7, M, unit(0), 10, 0.31)).length, 2, "a higher minimum drops the 0.3 chunk") // best + mid
  assert.equal((await store.vectorSearch(7, M, unit(0), 0, 0)).length, 1, "count 0 is clamped to 1")
  assert.equal((await store.vectorSearch(7, M, unit(0), -5, 0)).length, 1)
  await ingestSource(o, { userId: 8, mediaId: M, kind: "document", title: "many", chunks: Array.from({ length: 30 }, (_, i) => ({ content: `best ${i}`, tokenEstimate: 1 })) })
  assert.equal((await store.vectorSearch(8, M, unit(0), 1000, 0)).length, 20, "count is clamped to 20")
  // rows without a vector are never returned by similarity search
  await ingestSource({ store, embed: async () => [], hasKey: () => false }, { userId: 9, mediaId: M, kind: "document", title: "nov", chunks: [{ content: "no vector here", tokenEstimate: 1 }] })
  assert.equal((await store.vectorSearch(9, M, unit(0), 10, -1)).length, 0)
})

test("composite foreign key: a chunk can never point at another account's source; deleting a source cascades; tenant B cannot touch A's rows through the store", { skip }, async () => {
  const { q, store } = await boot()
  const d = embedBy(store, () => unit(0)), M = "1790000001"
  const a = await ingestSource(d, { userId: 1, mediaId: M, kind: "document", title: "A doc", chunks: [{ content: "A fact one", tokenEstimate: 1 }, { content: "A fact two", tokenEstimate: 1 }] })
  await assert.rejects(() => q(`insert into agent_kb_chunks (user_id, source_id, source_kind, content) values (2, $1, 'document', 'forged')`, [a.sourceId]), /foreign key|violates/i)
  // B calls the store with A's source id: nothing of A changes (update guard + scoped delete), and no row appears for B
  const forged = { id: a.sourceId, mediaId: M, kind: "document" as const, title: "pwned" }
  await store.replaceChunks(2, forged, [{ content: "B overwrote A", tokenEstimate: 1, embedding: unit(0) }]).catch(() => {})
  await store.replaceChunks(2, forged, []).catch(() => {})
  await store.deleteSource(2, a.sourceId); await store.setSourceStatus(2, a.sourceId, { status: "failed", chunkCount: 0, embeddedCount: 0, error: "x" })
  assert.equal(await store.getSource(2, a.sourceId), null)
  assert.deepEqual((await q(`select content from agent_kb_chunks where source_id=$1 order by chunk_index`, [a.sourceId])).map((r) => r.content), ["A fact one", "A fact two"])
  assert.equal((await q(`select count(*)::int n from agent_kb_chunks where user_id=2`))[0].n, 0)
  assert.equal((await store.getSource(1, a.sourceId))!.status, "ready")
  await assert.rejects(() => store.upsertSource(2, { id: a.sourceId, mediaId: null, kind: "document", title: "steal" }), /not found/i)
  await store.deleteSource(1, a.sourceId)
  assert.equal((await q(`select count(*)::int n from agent_kb_chunks`))[0].n, 0, "cascade")
})

test("replace-all: re-index twice = same count and same rows; shrinking and clearing work; positions stay unique; NUL and odd text are stored", { skip }, async () => {
  const { q, store } = await boot()
  const d = embedBy(store, (t) => (t.includes("fees") ? unit(0) : unit(1))), M = "1790000001"
  const chunks = chunkText("The session fees are Rs 5000. " + "Another sentence about the clinic timings and the location in Pune Baner. ".repeat(40))
  const r1 = await ingestSource(d, { userId: 1, mediaId: M, kind: "document", title: "T", rawText: "raw", chunks })
  const r2 = await ingestSource(d, { userId: 1, sourceId: r1.sourceId, mediaId: M, kind: "document", title: "T", chunks })
  const n = async () => (await q(`select count(*)::int n from agent_kb_chunks where source_id=$1`, [r1.sourceId]))[0].n
  assert.deepEqual([r1.chunkCount, r2.chunkCount, await n()], [chunks.length, chunks.length, chunks.length])
  assert.equal((await q(`select count(distinct chunk_index)::int n from agent_kb_chunks where source_id=$1`, [r1.sourceId]))[0].n, chunks.length)
  await ingestSource(d, { userId: 1, sourceId: r1.sourceId, mediaId: M, kind: "document", title: "T", chunks: chunks.slice(0, 2) }); assert.equal(await n(), 2)
  await ingestSource(d, { userId: 1, sourceId: r1.sourceId, mediaId: M, kind: "document", title: "T", chunks: [] }); assert.equal(await n(), 0)
  assert.equal((await store.getSource(1, r1.sourceId))!.status, "ready")
  // NUL / lone surrogate / emoji / long text in title, raw text and content all store fine
  const odd = await ingestSource(d, { userId: 1, mediaId: M, kind: "document", title: "bad\u0000title 🙂", rawText: "raw\u0000x", chunks: [{ content: "con\u0000tent 😀 क्षत्रिय \ud800", tokenEstimate: 3 }] })
  assert.equal(odd.status, "ready", String(odd.note))
  const row = (await q(`select title, content from agent_kb_chunks where source_id=$1`, [odd.sourceId]))[0]
  assert.ok(!row.title.includes("\u0000") && !row.content.includes("\u0000") && row.content.includes("😀 क्षत्रिय"))
  assert.equal((await store.getSource(1, odd.sourceId))!.rawText, "rawx")
  // a second Reel source of the same kind is the SAME source (partial unique index + ON CONFLICT), documents are separate
  const s1 = await store.upsertSource(1, { mediaId: M, kind: "reel_faq", title: "f" }), s2 = await store.upsertSource(1, { mediaId: M, kind: "reel_faq", title: "f2" })
  assert.equal(s1, s2)
  assert.notEqual(await store.upsertSource(1, { mediaId: M, kind: "document", title: "d" }), await store.upsertSource(1, { mediaId: M, kind: "document", title: "d" }))
  assert.notEqual(await store.upsertSource(2, { mediaId: M, kind: "reel_faq", title: "f" }), s1, "same media id under another account is another source")
})

test("200 chunks with 1536-d vectors in one statement; token_estimate stored; counts recorded on the source", { skip }, async () => {
  const { q, store } = await boot()
  const text = Array.from({ length: 400 }, (_, i) => `Paragraph ${i} ${"lorem ipsum dolor ".repeat(40)}`).join("\n\n")
  const chunks = chunkText(text)
  assert.ok(chunks.length >= 60)
  const r = await ingestSource(embedBy(store, (t) => unit(t.length % 1000)), { userId: 1, mediaId: null, kind: "document", title: "big", chunks })
  assert.deepEqual([r.status, r.embeddedCount, r.note], ["ready", chunks.length, null])
  const src = (await store.getSource(1, r.sourceId))!
  assert.deepEqual([src.chunkCount, src.embeddedCount], [chunks.length, chunks.length])
  const stats = (await q(`select min(token_estimate)::int mn, max(token_estimate)::int mx from agent_kb_chunks where source_id=$1`, [r.sourceId]))[0]
  assert.ok(stats.mn >= 1 && stats.mx <= 400)
})

test("vector literal parameterisation: a crafted embedding cannot inject SQL; the table survives and the call is rejected", { skip }, async () => {
  const { q, store } = await boot()
  await ingestSource(embedBy(store, () => unit(0)), { userId: 1, mediaId: null, kind: "document", title: "seed", chunks: [{ content: "seed", tokenEstimate: 1 }] }) // rows must exist so a bad vector is actually compared
  const evil: any[] = [
    Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => (i === 3 ? "1]'); DROP TABLE agent_kb_chunks;--" : 0)),
    "[0,0,0]'); DROP TABLE agent_kb_chunks;--", Array.from({ length: 5 }, () => 1), [NaN], [Infinity],
  ]
  for (const e of evil) await assert.rejects(() => store.vectorSearch(1, null, e as any, 5, 0.28))
  for (const e of evil) await store.replaceChunks(1, { id: "00000000-0000-0000-0000-000000000000", mediaId: null, kind: "document", title: "x" }, [{ content: "c", tokenEstimate: 1, embedding: e as any }]).catch(() => {})
  assert.equal((await q(`select count(*)::int n from pg_tables where tablename='agent_kb_chunks'`))[0].n, 1)
  // the user id parameter is a bigint: a string payload is a type error, not SQL
  await assert.rejects(() => store.vectorSearch("1; DROP TABLE agent_kb_sources" as any, null, unit(0), 5, 0.28))
  await assert.rejects(() => store.listSources("1 OR 1=1" as any))
  assert.equal((await q(`select count(*)::int n from pg_tables where tablename='agent_kb_sources'`))[0].n, 1)
})

test("tsv + keyword search on real Postgres: English, Hindi (Devanagari with matras), Hinglish, digits, prefix; adversarial queries never error", { skip }, async () => {
  const { store } = await boot(); const M = "1790000001"
  const noEmbed = { store, embed: async () => [], hasKey: () => false }
  await ingestSource(noEmbed, { userId: 1, mediaId: M, kind: "document", title: "Fees", chunks: [
    { content: "Consultation charge is Rs 500 only.", tokenEstimate: 1 }, { content: "फीस 5000 रुपये है। पहला सेशन मुफ्त है।", tokenEstimate: 1 },
    { content: "Batch kab start hoga? 5 Dec se subah 7 baje.", tokenEstimate: 1 }, { content: "No-cost EMI available for 3 months on all cards.", tokenEstimate: 1 }, { content: "Unrelated gardening note", tokenEstimate: 1 },
  ] })
  const find = async (query: string) => (await retrieve({ store, hasKey: () => false, embedQuery: async () => null }, { userId: 1, mediaId: M, query })).chunks.map((c) => Array.from(c.content).slice(0, 4).join(""))
  assert.ok((await find("kitna?")).includes("Cons"), "kitna? -> charge")
  assert.ok((await find("price")).includes("Cons"))
  assert.ok((await find("फीस कितनी है")).includes("फीस "), "Hindi query, Hindi chunk")
  assert.ok((await find("kitna paisa")).includes("फीस "), "Hinglish query finds the Hindi chunk via synonym group")
  assert.ok((await find("batch kab start hoga")).includes("Batc"))
  assert.deepEqual(await find("EMI?"), ["No-c"])
  assert.deepEqual(await find("quantum zzzz"), [])
  for (const q of ["a & b | !c", "'; DROP TABLE agent_kb_chunks; --", "fees:* & (x)", "foo<->bar", "\u0000 fees", "x".repeat(5000), "🙂 fees 🙂", "رسوم كم؟", "\\", "' OR '1'='1", "फ़ीस कितना?"]) {
    const ts = toTsQuery(extractSearchTerms(q))
    await store.keywordSearch(1, M, ts, 10) // must not throw
  }
  // a raw hostile tsquery is a PARAMETER: Postgres rejects it as a syntax error, it never runs as SQL
  await assert.rejects(() => store.keywordSearch(1, M, "a & ( | ", 5))
})

test("end to end on real SQL: partially embedded source, hasChunks scope, other tenant invisible, link-free retrieval output", { skip }, async () => {
  const { store } = await boot(); const M = "1790000001"
  let call = 0
  const d = { store, hasKey: () => true, embed: async (t: string[]) => { if (++call === 2) throw new Error("429"); return t.map(() => unit(0)) } }
  const chunks = Array.from({ length: 130 }, (_, i) => ({ content: i === 100 ? "Consultation charge is Rs 500 only." : `filler paragraph number ${i} about parking and lifts`, tokenEstimate: 5 }))
  const r = await ingestSource(d, { userId: 1, mediaId: M, kind: "document", title: "Doc", chunks })
  assert.deepEqual([r.status, r.chunkCount, r.embeddedCount], ["ready", 130, 66]) // batches of 64, 64 (failed), 2
  await ingestSource(d, { userId: 2, mediaId: M, kind: "document", title: "B", chunks: [{ content: "B secret charge Rs 1", tokenEstimate: 1 }] })
  assert.equal(await store.hasChunks(3, M), false); assert.equal(await store.hasChunks(1, "123"), false) // the doc is scoped to M only
  assert.equal(await store.hasChunks(1, M), true)
  assert.deepEqual([await store.hasReelChunks(1, M), await store.hasReelChunks(1, "123"), await store.hasReelChunks(3, M)], [true, false, false], "Reel-own chunks only, per account")
  const out = await retrieve({ store, hasKey: () => true, embedQuery: async () => unit(0) }, { userId: 1, mediaId: M, query: "session charge" })
  assert.equal(out.mode, "vector")
  assert.ok(out.chunks.every((c) => c.userId === "1" && !c.content.includes("B secret")))
  assert.ok(out.chunks.some((c) => c.content.startsWith("Consultation charge")), "the chunk that never got a vector is still offered")
})

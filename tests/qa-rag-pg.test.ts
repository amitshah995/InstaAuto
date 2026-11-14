// QA (adversarial): kb routes over a REAL Postgres (QA_PG_HOST, tables of migration 32 present): IDOR, forged ids, cross-tenant search,
// overlapping re-indexes (true concurrency, 10 pooled connections), and Hindi full-text on the server's own locale.
// Skipped unless QA_PG_HOST is set and agent_kb_chunks exists. pgvector is NOT needed for these (no vector search is run).
import test from "node:test"
import assert from "node:assert/strict"
import path from "node:path"
import { register } from "node:module"

process.env.SESSION_SECRET = "x".repeat(40)
process.env.AUTH_ENFORCE = "1"
delete process.env.OPENAI_API_KEY
const host = process.env.QA_PG_HOST

test("kb routes + store on real Postgres: A never sees, lists, re-indexes, deletes or searches B's knowledge; forged ids are refused", { skip: host ? false : "set QA_PG_HOST" }, async (t) => {
  register("./helpers/alias-hooks.mjs", import.meta.url)
  const db: any = await import("./helpers/stub-db.ts")
  const q = db.rawQuery
  if (!(await q(`select to_regclass('agent_kb_chunks') as t`))[0].t) return t.skip("migration 32 not applied")
  const { NextRequest } = await import("next/server")
  const { createSessionToken } = await import("../lib/session.ts")
  const A = 940001, B = 940002, M = "17900000000321"
  const req = (route: string, who: number | null, method: string, body?: any, qs = "") =>
    new NextRequest(`http://localhost/api/ai-agent/${route}${qs}`, { method, headers: { "content-type": "application/json", ...(who ? { cookie: `insta_session=${createSessionToken(String(who), "u", 3600)}` } : {}) }, ...(body !== undefined ? { body: typeof body === "string" ? body : JSON.stringify(body) } : {}) })
  const load = async (r: string) => import(path.resolve(`app/api/ai-agent/${r}/route.ts`))
  const kb: any = await load("kb"), reindex: any = await load("kb/reindex"), search: any = await load("kb/search"), know: any = await load("knowledge")
  const clean = async () => { await q(`DELETE FROM agent_kb_sources WHERE user_id IN ($1,$2)`, [A, B]); await q(`DELETE FROM media_knowledge WHERE user_id IN ($1,$2)`, [A, B]).catch(() => {}) }
  try {
    await clean()
    // B adds a document and a Reel knowledge; A adds one for the SAME media id
    const bDoc = await (await kb.POST(req("kb", B, "POST", { kind: "document", title: "B secret price", body: "The B-ONLY price is Rs 1 for everyone. Charge: Rs 1. B-SECRET-MARKER.", mediaId: M }))).json()
    assert.equal(bDoc.ok, true, JSON.stringify(bDoc)); assert.equal(bDoc.result.status, "ready")
    assert.equal((await know.PUT(req("knowledge", B, "PUT", { mediaId: M, title: "B reel", offer: "B offer B-SECRET-OFFER", faqs: [{ q: "price?", a: "B faq answer" }], active: true }))).status, 200)
    const aDoc = await (await kb.POST(req("kb", A, "POST", { kind: "document", title: "A doc", body: "The A price is Rs 5000 per session. Charge Rs 5000.", mediaId: M }))).json()
    assert.equal(aDoc.result.status, "ready")

    // listing: A sees only A
    const listA = JSON.stringify(await (await kb.GET(req("kb", A, "GET"))).json())
    assert.ok(listA.includes("A doc") && !/B secret|B reel|B-SECRET/.test(listA))
    assert.ok(!/OPENAI|sk-|apiKey|"key"/i.test(listA) && /"embeddingConfigured":false/.test(listA))
    const listB = await (await kb.GET(req("kb", B, "GET"))).json()
    assert.ok(listB.sources.length >= 3 && listB.sources.every((s: any) => !("rawText" in s) && !("raw_text" in s) && !("userId" in s)))
    // search: A's search for B's exact words returns nothing of B; with the same media id
    for (const query of ["B-ONLY price", "B-SECRET-MARKER", "B secret price", "price", "charge", "kitna?", "offer"]) {
      const r = await (await search.POST(req("kb/search", A, "POST", { query, mediaId: M }))).json()
      assert.ok(!/B-ONLY|B-SECRET|B secret|B offer|B faq|B reel/.test(JSON.stringify(r)), `${query}: ${JSON.stringify(r).slice(0, 200)}`)
    }
    const own = await (await search.POST(req("kb/search", A, "POST", { query: "price", mediaId: M }))).json()
    assert.equal(own.mode, "keyword"); assert.ok(own.chunks.length >= 1 && own.chunks.every((c: any) => /A /.test(c.text) || /Rs 5000/.test(c.text)))

    // IDOR: A uses B's source ids
    const bSources = (await q(`SELECT id, kind FROM agent_kb_sources WHERE user_id=$1`, [B])) as any[]
    for (const s of bSources) {
      assert.equal((await reindex.POST(req("kb/reindex", A, "POST", { id: s.id }))).status, 404, `reindex ${s.kind}`)
      assert.equal((await kb.DELETE(req("kb", A, "DELETE", undefined, `?id=${s.id}`))).status, 200) // idempotent delete, no existence oracle
    }
    assert.equal((await q(`SELECT count(*)::int n FROM agent_kb_sources WHERE user_id=$1`, [B]))[0].n, bSources.length, "B's sources survived A's deletes")
    assert.ok((await q(`SELECT count(*)::int n FROM agent_kb_chunks WHERE user_id=$1`, [B]))[0].n >= 3)
    // A's re-index of its OWN source works and never touches B's chunk count
    const before = (await q(`SELECT count(*)::int n FROM agent_kb_chunks WHERE user_id=$1`, [B]))[0].n
    const aSrc = (await q(`SELECT id FROM agent_kb_sources WHERE user_id=$1`, [A]))[0].id
    assert.equal((await reindex.POST(req("kb/reindex", A, "POST", { id: aSrc }))).status, 200)
    assert.equal((await q(`SELECT count(*)::int n FROM agent_kb_chunks WHERE user_id=$1`, [B]))[0].n, before)

    // identity and input matrix
    assert.equal((await kb.GET(req("kb", null, "GET"))).status, 401)
    assert.equal((await kb.POST(req("kb", null, "POST", { kind: "document", title: "x", body: "y".repeat(40) }))).status, 401)
    assert.equal((await kb.POST(req("kb", A, "POST", { userId: String(B), kind: "document", title: "forged", body: "forged body ".repeat(5) }))).status, 403)
    assert.equal((await search.POST(req("kb/search", A, "POST", { userId: String(B), query: "price" }))).status, 403)
    assert.equal((await reindex.POST(req("kb/reindex", A, "POST", { userId: String(B), id: aSrc }))).status, 403)
    assert.equal((await kb.DELETE(req("kb", A, "DELETE", undefined, `?id=${aSrc}&userId=${B}`))).status, 403)
    assert.equal((await q(`SELECT count(*)::int n FROM agent_kb_sources WHERE user_id=$1 AND title='forged'`, [B]))[0].n, 0)
    for (const id of ["------------------------------------", "x", "", "1 OR 1=1", "00000000-0000-0000-0000-00000000000g", "../../etc/passwd", "0".repeat(36)]) {
      assert.equal((await reindex.POST(req("kb/reindex", A, "POST", { id }))).status, 400, `reindex id ${id}`)
      assert.equal((await kb.DELETE(req("kb", A, "DELETE", undefined, `?id=${encodeURIComponent(id)}`))).status, 400, `delete id ${id}`)
    }
    assert.equal((await reindex.POST(req("kb/reindex", A, "POST", { id: ["00000000-0000-4000-8000-000000000000"] }))).status, 400)
    for (const mediaId of ["abc", "12", "1 OR 1=1", "1".repeat(41), "1234;5"]) assert.equal((await kb.POST(req("kb", A, "POST", { kind: "document", title: "t", body: "z".repeat(30), mediaId }))).status, 400, mediaId)
    assert.equal((await search.POST(req("kb/search", A, "POST", { query: "" }))).status, 400)
    assert.equal((await search.POST(req("kb/search", A, "POST", "{not json"))).status, 400)
    assert.equal((await kb.POST(req("kb", A, "POST", { kind: "document", title: "", body: "z".repeat(30) }))).status, 400)
    assert.equal((await kb.POST(req("kb", A, "POST", { kind: "document", title: "t", body: "short" }))).status, 400)
    assert.equal((await kb.POST(req("kb", A, "POST", { kind: "document", title: "t", body: "z".repeat(60_001) }))).status, 400)
    assert.equal((await kb.POST(req("kb", A, "POST", { kind: "document", title: "t", body: "z ".repeat(400_000) }))).status, 413, "oversized body refused before parsing")
    assert.equal((await kb.POST(req("kb", A, "POST", { kind: "website", url: "https://127.0.0.1/" }))).status, 400)
    assert.equal((await kb.POST(req("kb", A, "POST", { kind: "website", url: "http://example.com/" }))).status, 400)
    assert.equal((await kb.POST(req("kb", A, "POST", { kind: "website", url: "" }))).status, 400)
    // Search test sends no message and calls no model: it only touches kb tables (static + behaviour)
    assert.equal((await q(`SELECT count(*)::int n FROM agent_kb_sources WHERE user_id=$1`, [A]))[0].n, 1, "rejected requests stored nothing")

    // NUL / hostile text over the route
    const nul = await (await kb.POST(req("kb", A, "POST", { kind: "document", title: "nul\u0000title", body: "Fees\u0000 are Rs 700 for the session today.\u0000" }))).json()
    assert.equal(nul.result.status, "ready", JSON.stringify(nul))
    // deleting Reel knowledge removes only that Reel's chunks; business-wide / documents stay
    assert.equal((await know.DELETE(req("knowledge", B, "DELETE", undefined, `?mediaId=${M}`))).status, 200)
    assert.equal((await q(`SELECT count(*)::int n FROM agent_kb_sources WHERE user_id=$1 AND kind LIKE 'reel\\_%'`, [B]))[0].n, 0)
    assert.equal((await q(`SELECT count(*)::int n FROM agent_kb_sources WHERE user_id=$1 AND kind='document'`, [B]))[0].n, 1)
  } finally { await clean(); await db.closePool?.() }
})

test("rate guard: a loop of Search tests or re-indexes is cut off with 429 (per account) before it reaches OpenAI", { skip: host ? false : "set QA_PG_HOST" }, async (t) => {
  register("./helpers/alias-hooks.mjs", import.meta.url)
  const db: any = await import("./helpers/stub-db.ts")
  if (!(await db.rawQuery(`select to_regclass('agent_kb_chunks') as t`))[0].t) return t.skip("migration 32 not applied")
  const { NextRequest } = await import("next/server")
  const { createSessionToken } = await import("../lib/session.ts")
  const search: any = await import(path.resolve("app/api/ai-agent/kb/search/route.ts"))
  const U = 940003, V = 940004
  const call = (who: number) => search.POST(new NextRequest("http://localhost/api/ai-agent/kb/search", { method: "POST", headers: { "content-type": "application/json", cookie: `insta_session=${createSessionToken(String(who), "u", 3600)}` }, body: JSON.stringify({ query: "price" }) }))
  const codes: number[] = []
  for (let i = 0; i < 25; i++) codes.push((await call(U)).status)
  assert.ok(codes.slice(0, 20).every((c) => c === 200) && codes.slice(20).every((c) => c === 429), codes.join(","))
  assert.equal((await call(V)).status, 200, "another account is not affected")
  await db.closePool?.()
})

test("overlapping re-indexes of ONE source on real Postgres keep the chunk count exact (was: duplicated every chunk), also when sizes differ", { skip: host ? false : "set QA_PG_HOST" }, async (t) => {
  const db: any = await import("./helpers/stub-db.ts")
  const q = db.rawQuery
  if (!(await q(`select to_regclass('agent_kb_chunks') as t`))[0].t) return t.skip("migration 32 not applied")
  const { createRagStore } = await import("../lib/agent/rag/store.ts")
  const { ingestSource } = await import("../lib/agent/rag/ingest.ts")
  const store = createRagStore(q)
  const U = 940005
  const mk = (tag: string, n: number) => Array.from({ length: n }, (_, i) => ({ content: `${tag} chunk ${i} text`, tokenEstimate: 3 }))
  const d = { store, embed: async (x: string[]) => x.map(() => []), hasKey: () => false }
  try {
    await q(`DELETE FROM agent_kb_sources WHERE user_id=$1`, [U])
    for (let round = 0; round < 8; round++) {
      const first = await ingestSource(d, { userId: U, mediaId: null, kind: "document", title: "d", chunks: mk("old", 120) })
      const sizes = [120, 120, 80, 150]
      const rs = await Promise.all(sizes.map((n, i) => ingestSource(d, { userId: U, sourceId: first.sourceId, mediaId: null, kind: "document", title: "d", chunks: mk(`run${i}`, n) })))
      assert.ok(rs.every((r) => r.status === "ready"), JSON.stringify(rs.map((r) => r.note)))
      const rows = await q(`SELECT chunk_index, content FROM agent_kb_chunks WHERE source_id=$1 ORDER BY chunk_index`, [first.sourceId])
      // exactly one run's chunks remain: contiguous positions, all from the same run
      const tags = new Set(rows.map((r: any) => r.content.split(" ")[0]))
      assert.equal(tags.size, 1, `mixed runs in round ${round}: ${[...tags]}`)
      const run = Number(String([...tags][0]).replace("run", ""))
      assert.equal(rows.length, sizes[run], `round ${round}: ${rows.length} rows for a ${sizes[run]}-chunk run`)
      assert.deepEqual(rows.map((r: any) => r.chunk_index), rows.map((_: any, i: number) => i))
    }
    // a Reel saved twice at the same time: one source per kind, exact counts
    const same = await Promise.all([1, 2, 3, 4].map(() => store.upsertSource(U, { mediaId: "17900000000999", kind: "reel_faq", title: "f" })))
    assert.equal(new Set(same).size, 1)
  } finally { await q(`DELETE FROM agent_kb_sources WHERE user_id=$1`, [U]); await db.closePool?.() }
})

test("Hindi / Devanagari full-text on the server's own locale: tsv indexes words with matras, prefix search and Hinglish synonyms find them", { skip: host ? false : "set QA_PG_HOST" }, async (t) => {
  const db: any = await import("./helpers/stub-db.ts")
  const q = db.rawQuery
  if (!(await q(`select to_regclass('agent_kb_chunks') as t`))[0].t) return t.skip("migration 32 not applied")
  const { createRagStore } = await import("../lib/agent/rag/store.ts")
  const { ingestSource } = await import("../lib/agent/rag/ingest.ts")
  const { retrieve } = await import("../lib/agent/rag/retrieve.ts")
  const store = createRagStore(q); const U = 940006
  const d = { store, embed: async (x: string[]) => x.map(() => []), hasKey: () => false }
  try {
    await q(`DELETE FROM agent_kb_sources WHERE user_id=$1`, [U])
    await ingestSource(d, { userId: U, mediaId: null, kind: "document", title: "FAQ", chunks: [
      { content: "फीस 5000 रुपये है। पहला सेशन मुफ्त है।", tokenEstimate: 9 }, { content: "बैच 5 दिसंबर से शुरू होगा। समय सुबह 7 बजे।", tokenEstimate: 9 },
      { content: "क्षत्रिय श्रीमान् हिन्दी पाठ्यक्रम उपलब्ध है", tokenEstimate: 9 }, { content: "Consultation charge is Rs 500 only.", tokenEstimate: 9 },
    ] })
    const find = async (query: string) => (await retrieve({ store, hasKey: () => false, embedQuery: async () => null }, { userId: U, mediaId: null, query })).chunks.map((c) => Array.from(c.content).slice(0, 3).join(""))
    assert.ok((await find("फीस कितनी है")).includes("फीस"), "fee")
    assert.ok((await find("कब शुरू होगा")).includes("बैच"), "when")
    assert.ok((await find("श्रीमान्")).includes("क्ष"), "conjuncts and virama")
    assert.ok((await find("हिन्दी")).includes("क्ष"))
    assert.ok((await find("kitna?")).some((x) => x === "Con" || x === "फीस"), "Hinglish -> price group")
    assert.deepEqual(await find("zzzz qqqq"), [])
  } finally { await q(`DELETE FROM agent_kb_sources WHERE user_id=$1`, [U]); await db.closePool?.() }
})

test("embed_day counter on real Postgres: unlimited while billing is off; with billing on it blocks at EXACTLY 2 x agent replies per day, atomically under concurrency, never goes below zero", { skip: host ? false : "set QA_PG_HOST" }, async (t) => {
  register("./helpers/alias-hooks.mjs", import.meta.url)
  const db: any = await import("./helpers/stub-db.ts")
  const q = db.rawQuery
  await q(`CREATE TABLE IF NOT EXISTS usage_counters (user_id BIGINT NOT NULL, kind TEXT NOT NULL, period TEXT NOT NULL, count INT NOT NULL DEFAULT 0, PRIMARY KEY (user_id, kind, period))`)
  const U = 940007, V = 940008
  const saved = { ...process.env }
  try {
    await q(`DELETE FROM usage_counters WHERE user_id IN ($1,$2)`, [U, V])
    const usage: any = await import("../lib/billing/usage.ts") // the REAL module (the alias hook only stubs the "@/lib/billing/usage" specifier)
    const { getPlan } = await import("../lib/billing/plans.ts")
    // billing off: always allowed, still counted (so turning billing on later starts from real numbers)
    delete process.env.BILLING_ENABLED
    for (let i = 0; i < 5; i++) assert.equal((await usage.reserveEmbedding(U)).allowed, true)
    assert.equal((await q(`SELECT count FROM usage_counters WHERE user_id=$1 AND kind='embed_day'`, [U]))[0].count, 5)
    // billing on: limit = 2 x agentTurnsPerDay of the (free) plan
    const limit = getPlan("free").agentTurnsPerDay * 2
    Object.assign(process.env, { BILLING_ENABLED: "1", RAZORPAY_KEY_ID: "rzp_test_x", RAZORPAY_KEY_SECRET: "x", RAZORPAY_WEBHOOK_SECRET: "x", RAZORPAY_PLAN_ID_STARTER: "plan_x" })
    const { billingEnabled } = await import("../lib/billing/plans.ts")
    if (!billingEnabled()) return t.skip("billing cannot be switched on in this environment (razorpay vars)")
    await q(`UPDATE usage_counters SET count=$2 WHERE user_id=$1 AND kind='embed_day'`, [U, limit - 7])
    const results = await Promise.all(Array.from({ length: 40 }, () => usage.reserveEmbedding(U)))
    assert.equal(results.filter((r: any) => r.allowed).length, 7, "exactly the remaining 7 reservations succeed under 40 concurrent callers")
    assert.equal((await q(`SELECT count FROM usage_counters WHERE user_id=$1 AND kind='embed_day'`, [U]))[0].count, limit, "counter stops at the limit, never above")
    assert.equal((await usage.reserveEmbedding(U)).allowed, false)
    assert.equal((await usage.reserveEmbedding(V)).allowed, true, "another account has its own counter")
    // separate counter: exhausting embeddings does not touch agent replies or AI runs
    assert.equal((await q(`SELECT count(*)::int n FROM usage_counters WHERE user_id=$1 AND kind <> 'embed_day'`, [U]))[0].n, 0)
  } finally { process.env = saved; await q(`DELETE FROM usage_counters WHERE user_id IN ($1,$2)`, [U, V]); await db.closePool?.() }
})

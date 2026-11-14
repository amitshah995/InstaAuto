// QA (adversarial): retrieval quality and fallbacks. Fake embeddings and an in-memory store that mimics the SQL (tenant scope,
// cosine similarity, prefix tsquery). No network, no database.
import test from "node:test"
import assert from "node:assert/strict"
import { EMBEDDING_DIMENSIONS, EmbedError, embedBatch, embedQuery, isValidVector, toVectorLiteral } from "../lib/agent/rag/embed.ts"
import { buildRetrievalQuery, conceptCount, conceptOf, extractSearchTerms, termHits, toTsQuery, tokenize } from "../lib/agent/rag/keywords.ts"
import { MAX_CHUNKS, MAX_CONTEXT_CHARS, MIN_SIMILARITY, rankKeywordHits, retrieve, selectChunks } from "../lib/agent/rag/retrieve.ts"
import { chooseKnowledgeView } from "../lib/agent/rag/context.ts"
import type { ChunkHit } from "../lib/agent/rag/store.ts"

const A = "1", B = "2", M = "1790000001"
const hit = (o: Partial<ChunkHit> & { id: string }): ChunkHit => ({ userId: A, sourceId: "s1", mediaId: M, sourceKind: "document", title: "Doc", content: "content", chunkIndex: 0, score: 0, ...o })

/** Tiny deterministic "embedding": hashed bag of words into 64 dimensions (cosine similarity is meaningful for shared words). */
const DIM = 64
function embedWords(text: string): number[] {
  const v = new Array(DIM).fill(0)
  for (const w of tokenize(text)) { let h = 0; for (const c of w) h = (h * 31 + c.codePointAt(0)!) >>> 0; v[h % DIM] += 1 }
  return v
}
const cosine = (a: number[], b: number[]) => { let d = 0, na = 0, nb = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2 } return na && nb ? d / Math.sqrt(na * nb) : 0 }

function memStore(rows: (ChunkHit & { embedding?: number[] | null })[]) {
  const calls: string[] = []
  const scope = (r: ChunkHit, u: any, m: string | null) => String(r.userId) === String(u) && (r.mediaId === null || (m !== null && r.mediaId === m))
  return {
    calls,
    async hasChunks(u: any, m: string | null) { return rows.some((r) => scope(r, u, m)) },
    async vectorSearch(u: any, m: string | null, e: number[], count: number, min: number) {
      calls.push("vector")
      return rows.filter((r) => scope(r, u, m) && r.embedding).map((r) => ({ r, s: cosine(r.embedding!, e) })).filter((x) => x.s >= min).sort((a, b) => b.s - a.s).slice(0, count).map((x) => ({ ...x.r, score: x.s }))
    },
    async keywordSearch(u: any, m: string | null, ts: string, limit: number) {
      calls.push("keyword")
      const terms = ts.split(" | ").map((t) => t.replace(":*", "")).filter(Boolean)
      return rows.filter((r) => scope(r, u, m) && tokenize(`${r.title} ${r.content}`).some((tok) => terms.some((t) => tok.startsWith(t)))).slice(0, limit).map((r: any) => ({ ...r, noVector: !r.embedding }))
    },
  }
}
const emb = (id: string, content: string, o: Partial<ChunkHit> = {}) => ({ ...hit({ id, content, ...o }), embedding: embedWords(content) })
const deps = (store: any, o: any = {}) => ({ store, hasKey: () => true, embedQuery: async (t: string) => embedWords(t), ...o })

test("ranking: with fake embeddings the passage that shares the question's words ranks first; scores are descending", async () => {
  const store = memStore([
    emb("price", "hair PRP session fees price is Rs 5000"), emb("loc", "our clinic is in Pune Baner near the metro"), emb("time", "session takes 45 minutes and clinic opens at 10"),
    emb("faq", "hair PRP price list session fees Rs 5000 per session"),
  ])
  const r = await retrieve(deps(store), { userId: A, mediaId: M, query: "hair PRP session fees price" })
  assert.equal(r.mode, "vector")
  assert.ok(["price", "faq"].includes(r.chunks[0].id))
  for (let i = 1; i < r.chunks.length; i++) assert.ok(r.chunks[i - 1].score >= r.chunks[i].score)
  assert.ok(!r.chunks.some((c) => c.id === "loc"))
})

test("threshold: default 0.28; an exact-threshold score is kept, just below is dropped; custom minimum is passed through", async () => {
  assert.equal(MIN_SIMILARITY, 0.28)
  let seen = -1
  const store = { hasChunks: async () => true, keywordSearch: async () => [], vectorSearch: async (_u: any, _m: any, _e: any, _c: any, min: number) => { seen = min; return [hit({ id: "x", content: "c" })] } }
  await retrieve(deps(store), { userId: A, mediaId: M, query: "anything" }); assert.equal(seen, 0.28)
  await retrieve(deps(store, { minSimilarity: 0.5 }), { userId: A, mediaId: M, query: "anything" }); assert.equal(seen, 0.5)
  // the SQL filter is `>=`: emulate both sides of the boundary with exact vectors
  const q = [1, 0]; const at = [0.28, Math.sqrt(1 - 0.28 ** 2)]; const below = [0.2799, Math.sqrt(1 - 0.2799 ** 2)]
  const mem = memStore([{ ...hit({ id: "at", content: "x" }), embedding: at }, { ...hit({ id: "below", content: "y" }), embedding: below }])
  const r = await retrieve({ store: mem, hasKey: () => true, embedQuery: async () => q }, { userId: A, mediaId: M, query: "zzz" })
  assert.deepEqual(r.chunks.map((c) => c.id), ["at"])
})

test("env minimum is parsed safely: garbage, zero, negative fall back to 0.28 (static check of service.ts)", async () => {
  const src = (await import("node:fs")).readFileSync("lib/agent/rag/service.ts", "utf8")
  assert.match(src, /Number\(process\.env\.AGENT_RAG_MIN_SIMILARITY\) > 0 \? Number\(process\.env\.AGENT_RAG_MIN_SIMILARITY\) : undefined/)
  for (const bad of ["abc", "", "0", "-0.5", "NaN"]) assert.ok(!(Number(bad) > 0), bad)
})

test("queries: empty / whitespace / punctuation-only / stop-word-only never throw and never return chunks from an empty search", async () => {
  const store = memStore([emb("a", "session fees are Rs 5000")])
  for (const q of ["", "   ", "\n\t", "???", "!!!", "है", "kya hai", "the and of", null as any, undefined as any, 42 as any]) {
    for (const key of [true, false]) {
      const r = await retrieve(deps(store, { hasKey: () => key, embedQuery: async () => (key ? embedWords("zzz qqq") : null) }), { userId: A, mediaId: M, query: q })
      assert.ok(Array.isArray(r.chunks) && r.chunks.length === 0, `${JSON.stringify(q)} key=${key}`)
      assert.equal(r.indexed, true)
    }
  }
  assert.deepEqual(extractSearchTerms(""), []); assert.equal(toTsQuery([]), "")
})

test("keyword fallback: one-word queries find the answer (kitna?, EMI?, cost, price?) even when the chunk uses ONE synonym", async () => {
  const store = memStore([
    hit({ id: "charge", content: "Consultation charge is Rs 500." }), hit({ id: "emi", content: "No-cost EMI available for 3 months on all cards." }),
    hit({ id: "hours", content: "We are open 9 hours a day; offices closed Sunday." }), hit({ id: "coffee", content: "Free coffee in the lounge." }),
    hit({ id: "cost", content: "Cost: Rs 5,000 per session." }),
  ])
  const run = async (query: string) => (await retrieve(deps(store, { hasKey: () => false }), { userId: A, mediaId: M, query })).chunks.map((c) => c.id)
  for (const q of ["kitna?", "price?", "cost", "fees", "rate kya hai", "paisa"]) {
    const ids = await run(q)
    assert.ok(ids.includes("charge") && ids.includes("cost"), `${q}: ${ids}`)
    assert.ok(!ids.includes("hours") && !ids.includes("coffee"), `${q} matched an unrelated chunk: ${ids}`)
  }
  assert.deepEqual(await run("EMI?"), ["emi"])
  assert.deepEqual(await run("EMI"), ["emi"])
})

test("keyword fallback: multi-concept questions still need two concepts (one shared word is not relevance), synonyms count once", () => {
  const rows = [hit({ id: "one", content: "hair care tips" }), hit({ id: "two", content: "hair PRP price list" }), hit({ id: "syn", content: "price fees charges cost" }), hit({ id: "zero", content: "nothing" })]
  const terms = extractSearchTerms("hair PRP kitna")
  assert.equal(conceptCount(terms), 3)
  assert.deepEqual(rankKeywordHits(rows, terms).map((r) => r.id), ["two"]) // "syn" has ONE concept (price) however many synonyms it lists
  assert.equal(conceptOf("kitna"), conceptOf("fees")); assert.notEqual(conceptOf("hair"), conceptOf("prp"))
  assert.equal(termHits("price fees charges cost rate", ["price", "fees", "cost"]), 3 - 2) // three words of one group = 1 concept
  // short terms are whole-word only
  assert.equal(termHits("open 9 hours, coffee, offices", ["rs", "off"]), 0); assert.equal(termHits("Fee: Rs 500, 20% off", ["rs", "off"]), 2)
})

test("Hindi / Devanagari / Hinglish: queries and chunks in either script are found; ending-trim never mangles non-Latin words", async () => {
  const store = memStore([
    hit({ id: "hi-fee", content: "फीस 5000 रुपये है। पहला सेशन मुफ्त है।" }), hit({ id: "hi-when", content: "बैच 5 दिसंबर से शुरू होगा। समय सुबह 7 बजे।", title: "Batch" }),
    hit({ id: "en-fee", content: "Fees are Rs 5000 per month." }), hit({ id: "hing", content: "Batch kab start hoga? 5 Dec se, subah 7 baje." }), hit({ id: "place", content: "Hum Pune ke Baner mein hain. पता: बाणेर, पुणे" }),
  ])
  const run = async (query: string) => (await retrieve(deps(store, { hasKey: () => false }), { userId: A, mediaId: M, query })).chunks.map((c) => c.id)
  const a = await run("फीस कितनी है"); assert.ok(a.includes("hi-fee") && a.includes("en-fee"), String(a))
  const b = await run("kitna paisa lagega"); assert.ok(b.includes("hi-fee") && b.includes("en-fee"), String(b))
  const c = await run("batch kab start hoga"); assert.ok(c.includes("hing"), String(c))
  const d = await run("कब शुरू होगा बैच"); assert.ok(d.includes("hi-when"), String(d))
  const e = await run("kahan hai aapka center"); assert.ok(e.includes("place"), String(e))
  assert.deepEqual(extractSearchTerms("क्या फीस है"), extractSearchTerms("फीस")) // filler words are dropped
  assert.equal(tokenize("कितना?").join(""), "कितना") // combining marks (matras) are kept inside the word
  assert.match(toTsQuery(extractSearchTerms("कितना फीस")), /^[\p{L}\p{M}\p{N}:* |]+$/u)
})

test("tsquery safety: operators, quotes, parentheses, SQL, NUL and very long input can only become letters/digits terms", () => {
  for (const q of ["a & b | !c", "'; DROP TABLE agent_kb_chunks; --", "fees:* & (x)", "foo<->bar", "\\u0000 fees", "fees\u0000", "x".repeat(5000), "a:*b", "🙂 fees 🙂", "رسوم كم؟"]) {
    const ts = toTsQuery(extractSearchTerms(q))
    assert.ok(ts === "" || /^[\p{L}\p{M}\p{N}]+:\*( \| [\p{L}\p{M}\p{N}]+:\*)*$/u.test(ts), `${q} -> ${ts}`)
    assert.ok(extractSearchTerms(q).length <= 24)
  }
})

test("follow-ups: short messages are searched with the previous exchange; long ones, and first messages, are not; capped", () => {
  const hist = [{ role: "user" as const, text: "tell me about hair PRP" }, { role: "assistant" as const, text: "Hair PRP is a 45 minute session. Want details?" }]
  assert.equal(buildRetrievalQuery("kitna?", hist).includes("hair PRP"), true)
  assert.equal(buildRetrievalQuery("EMI?", hist).includes("45 minute"), true)
  assert.equal(buildRetrievalQuery("ok", hist).includes("hair PRP"), true)
  assert.equal(buildRetrievalQuery("what are the fees for the hair package please", hist), "what are the fees for the hair package please")
  assert.equal(buildRetrievalQuery("kitna?", []), "kitna?")
  assert.equal(buildRetrievalQuery("kitna?", [{ role: "user", text: "x".repeat(5000) }, { role: "assistant", text: "y".repeat(5000) }]).length <= 6 + 1 + 400 + 1, true)
  assert.equal(buildRetrievalQuery("word ".repeat(400), hist).length, 500)
  assert.ok(buildRetrievalQuery("a".repeat(2000), hist).length <= 500 + 1 + 400 + 1) // one huge "word" counts as a short message: base + capped context
})

test("no OPENAI_API_KEY: no embedding call at all; the answer comes from keyword search and says why", async () => {
  let fetched = 0
  const f = (async () => { fetched++; throw new Error("must not be called") }) as any
  assert.equal(await embedQuery("price", { fetchImpl: f, apiKey: "" }), null)
  await assert.rejects(() => embedBatch(["x"], { fetchImpl: f, apiKey: "  " }), (e: any) => e instanceof EmbedError && !/sk-/.test(e.message))
  assert.equal(fetched, 0)
  const store = memStore([emb("a", "session fees Rs 5000")])
  const r = await retrieve(deps(store, { hasKey: () => false }), { userId: A, mediaId: M, query: "fees" })
  assert.deepEqual([r.mode, r.chunks.length, store.calls.includes("vector")], ["keyword", 1, false]); assert.match(String(r.fallbackReason), /No embedding key/)
})

test("embeddings API failures (429, 500, 401, malformed JSON, HTML, wrong dimensions, NaN, null, wrong count, timeout) never throw into retrieval and never leak the key or text", async () => {
  const vec = (n = EMBEDDING_DIMENSIONS) => Array.from({ length: n }, (_, i) => i / 1000)
  const mk = (res: any) => (async () => res) as any
  const cases: [string, any][] = [
    ["429", { ok: false, status: 429, json: async () => ({ error: { message: "rate limit sk-SECRET text: price" } }) }],
    ["500", { ok: false, status: 500, json: async () => ({}) }],
    ["401", { ok: false, status: 401, json: async () => ({}) }],
    ["bad json", { ok: true, status: 200, json: async () => { throw new SyntaxError("Unexpected token < in JSON") } }],
    ["no data", { ok: true, status: 200, json: async () => ({}) }],
    ["data not array", { ok: true, status: 200, json: async () => ({ data: "x" }) }],
    ["null body", { ok: true, status: 200, json: async () => null }],
    ["wrong dims", { ok: true, status: 200, json: async () => ({ data: [{ index: 0, embedding: vec(1535) }] }) }],
    ["too many dims", { ok: true, status: 200, json: async () => ({ data: [{ index: 0, embedding: vec(3072) }] }) }],
    ["NaN", { ok: true, status: 200, json: async () => ({ data: [{ index: 0, embedding: vec().map((x, i) => (i === 5 ? NaN : x)) }] }) }],
    ["strings", { ok: true, status: 200, json: async () => ({ data: [{ index: 0, embedding: vec().map(String) }] }) }],
    ["null embedding", { ok: true, status: 200, json: async () => ({ data: [{ index: 0, embedding: null }] }) }],
    ["wrong count", { ok: true, status: 200, json: async () => ({ data: [] }) }],
  ]
  for (const [name, res] of cases) {
    await assert.rejects(() => embedBatch(["price question"], { fetchImpl: mk(res), apiKey: "sk-SECRET" }), (e: any) => e instanceof EmbedError && !/sk-SECRET|price/.test(e.message), name)
    assert.equal(await embedQuery("price question", { fetchImpl: mk(res), apiKey: "sk-SECRET" }), null, name)
  }
  const never = ((_u: string, init: any) => new Promise((_res, rej) => init.signal.addEventListener("abort", () => rej(Object.assign(new Error("x"), { name: "AbortError" }))))) as any
  const t0 = Date.now()
  assert.equal(await embedQuery("q", { fetchImpl: never, apiKey: "k", timeoutMs: 30 }), null); assert.ok(Date.now() - t0 < 1000)
  assert.equal(await embedQuery("q", { fetchImpl: (async () => { throw new Error("ECONNRESET sk-SECRET") }) as any, apiKey: "k" }), null)
  // retrieval with an embedder that fails or throws: keyword fallback, no exception
  const store = memStore([emb("a", "session fees Rs 5000")])
  for (const embedder of [async () => null, async () => { throw new Error("boom") }]) {
    const r = await retrieve(deps(store, { embedQuery: embedder }), { userId: A, mediaId: M, query: "fees" })
    assert.ok(r.chunks.length === 1 || r.mode === "none") // a throwing embedder is caught by the outer guard: no chunks, no exception
  }
})

test("vector literal safety: only finite numbers reach SQL, and the literal travels as a parameter", () => {
  assert.equal(isValidVector(Array(EMBEDDING_DIMENSIONS).fill(0.1)), true)
  for (const bad of [Array(1535).fill(0), "[1,2]", null, Array(EMBEDDING_DIMENSIONS).fill("1); DROP TABLE x;--"), Array(EMBEDDING_DIMENSIONS).fill(Infinity), Array(EMBEDDING_DIMENSIONS).fill(undefined)]) assert.equal(isValidVector(bad as any), false)
  assert.equal(toVectorLiteral([1, 2.5, -3e-7]), "[1,2.5,-3e-7]")
})

test("partially embedded sources: a chunk WITHOUT a vector is still found by keyword when the vector search returns other chunks", async () => {
  const rows = [
    emb("e1", "hair PRP session"),
    { ...hit({ id: "no-vec", content: "Consultation charge is Rs 500 only." }), embedding: null },
  ]
  const store = memStore(rows as any)
  const r = await retrieve(deps(store), { userId: A, mediaId: M, query: "session charge" })
  assert.equal(r.mode, "vector")
  assert.ok(r.chunks.some((c) => c.id === "e1"))
  assert.ok(r.chunks.some((c) => c.id === "no-vec"), "the un-embedded chunk (embedding call failed for its batch) was invisible")
})

test("context cap: at most 5 chunks and 3000 CHARACTERS (code points, so emoji and Devanagari are not double counted); one huge chunk is cut", () => {
  const emoji = "😀".repeat(900)
  const sel = selectChunks(Array.from({ length: 10 }, (_, i) => hit({ id: `e${i}`, content: emoji })), A)
  assert.ok(sel.length <= MAX_CHUNKS)
  assert.ok(sel.reduce((n, c) => n + Array.from(c.content).length, 0) <= MAX_CONTEXT_CHARS)
  assert.ok(sel.every((c) => !/[\ud800-\udbff]$|^[\udc00-\udfff]/.test(c.content)), "no surrogate pair cut in half")
  const big = selectChunks([hit({ id: "big", content: "क".repeat(10_000) })], A)
  assert.equal(Array.from(big[0].content).length, MAX_CONTEXT_CHARS)
  assert.deepEqual(selectChunks([], A), []); assert.deepEqual(selectChunks([hit({ id: "x", content: "" })], A), [])
  assert.equal(selectChunks([hit({ id: "n", userId: undefined as any })], A).length, 0)
})

test("nothing relevant: indexed + no match -> empty result; the knowledge view tells the agent to hand over (large) or keeps the small knowledge", async () => {
  const store = memStore([{ ...hit({ id: "a", content: "session fees Rs 5000" }), embedding: [1, 0, ...new Array(DIM - 2).fill(0)] }, { ...hit({ id: "b", content: "clinic in Pune" }), embedding: [0, 1, ...new Array(DIM - 2).fill(0)] }])
  const r = await retrieve(deps(store, { embedQuery: async () => { const v = new Array(DIM).fill(0); v[DIM - 1] = 1; return v } }), { userId: A, mediaId: M, query: "quantum chromodynamics lagrangian" })
  assert.deepEqual([r.mode, r.indexed, r.chunks.length], ["none", true, 0])
  const small = { mediaId: M, title: "T", caption: "c", offer: "o", faqs: [] }
  const large = { ...small, offer: "x".repeat(4000) }
  assert.equal(chooseKnowledgeView(small as any, r).mode, "stuffing")
  const v = chooseKnowledgeView(large as any, r); assert.deepEqual([v.mode, (v as any).noneFound, (v as any).passages.length], ["rag", true, 0])
})

test("retrieval failures: database error, hasChunks false, embedder throwing -> an empty, well-formed Retrieval (agent keeps its previous behaviour)", async () => {
  const boom = { hasChunks: async () => { throw new Error('relation "agent_kb_chunks" does not exist') }, vectorSearch: async () => [], keywordSearch: async () => [] }
  const r = await retrieve(deps(boom), { userId: A, mediaId: M, query: "price" })
  assert.deepEqual([r.mode, r.indexed, r.chunks, r.totalChars, r.sourceTitles], ["none", false, [], 0, []])
  const ks = { hasChunks: async () => true, vectorSearch: async () => { throw new Error("rpc") }, keywordSearch: async () => { throw new Error("kw") } }
  const r2 = await retrieve(deps(ks), { userId: A, mediaId: M, query: "price" })
  assert.deepEqual([r2.mode, r2.chunks.length], ["none", 0])
})

test("tenant defence in depth: every possible leak path of the store is filtered in code (vector, keyword, forged userId types)", async () => {
  const leaky = {
    hasChunks: async () => true,
    vectorSearch: async () => [hit({ id: "b1", userId: B, content: "B secret" }), hit({ id: "a1", userId: A, content: "A ok" }), hit({ id: "n", userId: null as any, content: "null owner" })],
    keywordSearch: async () => [hit({ id: "b2", userId: B, content: "B secret price" }), hit({ id: "a2", userId: A, content: "A price" }), hit({ id: "num", userId: 1 as any, content: "A numeric owner price" })],
  }
  const v = await retrieve(deps(leaky), { userId: A, mediaId: M, query: "price" })
  assert.deepEqual(v.chunks.map((c) => c.id), ["a1"])
  const k = await retrieve(deps(leaky, { hasKey: () => false }), { userId: A, mediaId: M, query: "price" })
  assert.ok(k.chunks.every((c) => String(c.userId) === A) && !k.chunks.some((c) => c.content.includes("B secret")))
  const forged = await retrieve(deps(leaky, { hasKey: () => false }), { userId: "1 OR 1=1", mediaId: M, query: "price" })
  assert.equal(forged.chunks.length, 0)
})

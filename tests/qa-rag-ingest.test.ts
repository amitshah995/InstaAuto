// QA (adversarial): chunking and ingest. Pure functions plus a fake store/embedder. Real-SQL behaviour is in qa-rag-pglite.test.ts.
import test from "node:test"
import assert from "node:assert/strict"
import { CHUNK_MAX, FAQ_CHUNK_MAX, MAX_CHUNKS_PER_SOURCE, MAX_SOURCE_CHARS, chunkFaqs, chunkText, estimateTokens, normalizeText, planReelSources } from "../lib/agent/rag/chunk.ts"
import { ingestSource } from "../lib/agent/rag/ingest.ts"
import { EMBED_BATCH_SIZE } from "../lib/agent/rag/embed.ts"
import { createRagStore } from "../lib/agent/rag/store.ts"

const A = "1", M = "1790000001"
const words = (s: string) => s.split(/\s+/).filter(Boolean)
const TEXT = "Hair PRP is a session of 45 minutes. Fees are Rs 5000 per session! Book on WhatsApp? हम पुणे में हैं। फीस 5000 रुपये है। ".repeat(60)

test("chunker: idempotent and deterministic; never empty chunks; never above the max; covers every word of the input", () => {
  const a = chunkText(TEXT), b = chunkText(TEXT)
  assert.deepEqual(a, b)
  assert.ok(a.length > 3)
  for (const c of a) { assert.ok(c.content.trim().length > 0); assert.ok(Array.from(c.content).length <= CHUNK_MAX, `${Array.from(c.content).length}`) }
  const covered = new Set(a.flatMap((c) => words(c.content)))
  for (const w of new Set(words(TEXT))) assert.ok(covered.has(w), `word lost: ${w}`)
})

test("chunker: CRLF, CR, tabs, NBSP, form feeds and blank-line runs are normalised; whitespace-only and control-only give no chunks", () => {
  const t = chunkText("First paragraph line.\r\nSecond line.\r\n\r\n\r\n\r\nThird\tparagraph here.\rLast")
  assert.equal(t.length, 1)
  assert.ok(!/[\r\t ]/.test(t[0].content))
  for (const empty of ["", "   ", "\n\n\t\r\n", "\u0000\u0001\u0002", "  ", null as any, undefined as any]) assert.deepEqual(chunkText(empty as any), [], JSON.stringify(empty))
})

test("chunker: NUL bytes and control characters are removed from every chunk (Postgres rejects \\u0000)", () => {
  const t = chunkText("Fees\u0000 are\u0001 Rs 5000\u0007.\u0000\u0000 Session\u001f is 45 minutes\u007f long.".repeat(3))
  assert.ok(t.length >= 1 && t.every((c) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(c.content)))
  const f = chunkFaqs([{ q: "Price\u0000?", a: "Rs\u0000 5000" }])
  assert.equal(f[0].content, "Q: Price?\nA: Rs 5000")
  assert.equal(normalizeText("a\u0000b"), "ab")
})

test("chunker: unicode survives - emoji, ZWJ sequences, combining marks, Devanagari conjuncts, lone surrogates never produce broken output", () => {
  const family = "👨‍👩‍👧‍👦", flag = "🇮🇳", combining = "é̂", dev = "क्षत्रिय श्रीमान् हिन्दी"
  const t = chunkText(`${family} ${flag} ${combining} ${dev}. ` + "😀".repeat(2000) + " \ud800 lone high \udc00 lone low.")
  const joined = t.map((c) => c.content).join(" ")
  assert.ok(joined.includes(family) && joined.includes(flag) && joined.includes(combining) && joined.includes(dev))
  for (const c of t) assert.ok(Array.from(c.content).length <= CHUNK_MAX)
  // Postgres/JSON would choke on lone surrogates only if they were split from a pair: pairs are never cut
  for (const c of t) assert.ok(!/[\ud800-\udbff](?![\udc00-\udfff])/.test(c.content.replace(/\ud800 lone high \udc00 lone low/, "")))
  assert.equal(chunkText("😀".repeat(1000)).every((c) => Array.from(c.content).every((ch) => ch === "😀" || ch === " ")), true)
})

test("chunker: a single enormous token (no spaces, no punctuation) and long no-space Devanagari are split, not dropped, within the caps", () => {
  const one = chunkText("x".repeat(MAX_SOURCE_CHARS * 2))
  assert.ok(one.length > 10 && one.length <= MAX_CHUNKS_PER_SOURCE)
  assert.ok(one.every((c) => Array.from(c.content).length <= CHUNK_MAX))
  assert.ok(one.reduce((n, c) => n + c.content.length, 0) >= MAX_SOURCE_CHARS * 0.9, "the 60k cap applies to the input, most of it is kept")
  const dev = chunkText("नमस्ते".repeat(20_000))
  assert.ok(dev.length > 10 && dev.every((c) => Array.from(c.content).length <= CHUNK_MAX))
  const urlish = chunkText("https://example.com/" + "a".repeat(5000) + "?q=1")
  assert.ok(urlish.length >= 5 && urlish.every((c) => Array.from(c.content).length <= CHUNK_MAX))
})

test("chunker: caps - input cut at 60,000 characters, output at 200 chunks, in linear time", () => {
  const t0 = Date.now()
  const big = chunkText("Sentence number one is here. ".repeat(100_000))
  assert.ok(big.length <= MAX_CHUNKS_PER_SOURCE)
  assert.ok(big.length >= 60, `60k characters make ~75-90 chunks, got ${big.length}`) // the 200 cap is a second fence behind the 60k input cap
  const small = chunkText("word ".repeat(30_000))
  assert.ok(small.length <= MAX_CHUNKS_PER_SOURCE)
  for (const nasty of ["!".repeat(60_000), ".".repeat(60_000), "।".repeat(60_000), "a.".repeat(30_000), "\n".repeat(60_000), " ".repeat(60_000), ("a" + "\n\n").repeat(20_000), "((((".repeat(15_000), "\"')]".repeat(15_000) + "x"]) chunkText(nasty)
  assert.ok(Date.now() - t0 < 5000, `${Date.now() - t0} ms`)
  assert.equal(MAX_SOURCE_CHARS, 60_000)
})

test("chunker: sentence boundaries (. ! ? danda) are respected and overlap links neighbours without exceeding the max", () => {
  const sentences = Array.from({ length: 200 }, (_, i) => `Sentence ${i} says the session fee is Rs ${1000 + i} today.`).join(" ")
  const t = chunkText(sentences)
  for (let i = 1; i < t.length; i++) {
    const prevTail = words(t[i - 1].content).slice(-6).join(" "), head = t[i].content
    assert.ok(head.includes(words(prevTail).slice(-2).join(" ")) || head.startsWith("Sentence"), `no overlap between chunk ${i - 1} and ${i}`)
  }
  assert.ok(t.every((c) => /^\S/.test(c.content) && c.content === c.content.trim()))
})

test("token_estimate is sane: >= 1 for any chunk, grows with length, roughly length/3 (also for Devanagari and emoji)", () => {
  assert.equal(estimateTokens(""), 0); assert.equal(estimateTokens("a"), 1)
  for (const c of chunkText(TEXT)) { const cp = Array.from(c.content).length; assert.ok(c.tokenEstimate >= 1 && Math.abs(c.tokenEstimate - Math.ceil(cp / 3)) <= 1) }
  assert.equal(estimateTokens("😀😀😀"), 1); assert.ok(estimateTokens("क".repeat(300)) === 100)
  assert.ok(Number.isInteger(chunkText("hello world today")[0].tokenEstimate))
})

test("FAQs: question and answer stay in ONE chunk; long answers split with the question repeated; empty / junk FAQs are skipped; 200 cap", () => {
  const f = chunkFaqs([{ q: "How long?\n\nreally", a: "45 minutes" }, { q: "", a: "orphan answer" }, { q: "orphan question", a: "" }, { q: "  ", a: "  " }, null as any, { q: "Price?", a: "Rs 5000\nplus tax" }])
  assert.deepEqual(f.map((c) => c.content.replace(/ {2,}/g, " ")), ["Q: How long? really\nA: 45 minutes", "Q: Price?\nA: Rs 5000\nplus tax"])
  const long = chunkFaqs([{ q: "Tell me everything?", a: "detail. ".repeat(900) }])
  assert.ok(long.length >= 2 && long.every((c) => c.content.startsWith("Q: Tell me everything?\nA: ") && Array.from(c.content).length <= FAQ_CHUNK_MAX))
  const hugeQ = chunkFaqs([{ q: "q".repeat(5000), a: "short answer" }])
  assert.ok(hugeQ.length >= 1 && hugeQ.every((c) => Array.from(c.content).length > 0))
  assert.equal(chunkFaqs(Array.from({ length: 500 }, (_, i) => ({ q: `q${i}`, a: `a${i}` }))).length, MAX_CHUNKS_PER_SOURCE)
  const reel = planReelSources({ mediaId: M, title: "", caption: "", offer: "", faqs: [] })
  assert.deepEqual(reel.map((p) => p.chunks.length), [0, 0, 0]); assert.match(reel[0].title, /^Reel: offer$/)
})

// ---------------------------------------------------------------- ingest
function mem() {
  const sources = new Map<string, any>(); const chunks = new Map<string, any[]>(); let n = 0; const log: string[] = []
  const store: any = {
    async upsertSource(userId: any, s: any) { log.push("upsert"); const id = s.id ?? `src${++n}`; sources.set(id, { ...s, id, userId, status: "pending" }); return id },
    async replaceChunks(userId: any, src: any, rows: any[]) { log.push("replace"); chunks.set(src.id, rows.map((r, i) => ({ ...r, userId, idx: i }))) },
    async setSourceStatus(_u: any, id: string, s: any) { log.push(`status:${s.status}`); Object.assign(sources.get(id), s) },
  }
  return { store, sources, chunks, log }
}
const mk = (k: number) => Array.from({ length: k }, (_, i) => ({ content: `chunk ${i}`, tokenEstimate: 2 }))
const unit = (i: number) => [i, 0, 0]

test("ingest: re-indexing twice gives the same rows and counts; shrinking and clearing remove old chunks; statuses end 'ready'", async () => {
  const m = mem()
  const d = { store: m.store, embed: async (t: string[]) => t.map((_x, i) => unit(i)), hasKey: () => true }
  const r1 = await ingestSource(d, { userId: A, mediaId: M, kind: "document", title: "D", chunks: mk(130) })
  const r2 = await ingestSource(d, { userId: A, sourceId: r1.sourceId, mediaId: M, kind: "document", title: "D", chunks: mk(130) })
  assert.deepEqual([r1.chunkCount, r2.chunkCount, r2.embeddedCount, r2.status], [130, 130, 130, "ready"])
  assert.equal(m.chunks.get(r1.sourceId)!.length, 130)
  const r3 = await ingestSource(d, { userId: A, sourceId: r1.sourceId, mediaId: M, kind: "document", title: "D", chunks: mk(3) }); assert.equal(m.chunks.get(r1.sourceId)!.length, 3); assert.equal(r3.chunkCount, 3)
  const r4 = await ingestSource(d, { userId: A, sourceId: r1.sourceId, mediaId: M, kind: "document", title: "D", chunks: [] }); assert.deepEqual([m.chunks.get(r1.sourceId)!.length, r4.status, r4.chunkCount], [0, "ready", 0])
})

test("ingest: batches of 64, one embeddings call per batch; wrong-count / throwing / quota-blocked batches only cost their own vectors", async () => {
  const m = mem(); const sizes: number[] = []
  let call = 0
  const embed = async (t: string[]) => { sizes.push(t.length); call++; if (call === 2) throw new Error("429 sk-LEAK"); if (call === 3) return t.slice(1).map(() => unit(1)); return t.map(() => unit(1)) }
  const r = await ingestSource({ store: m.store, embed, hasKey: () => true }, { userId: A, mediaId: M, kind: "document", title: "D", chunks: mk(64 * 4 + 5) })
  assert.deepEqual(sizes, [64, 64, 64, 64, 5])
  assert.equal(r.chunkCount, 261); assert.equal(r.embeddedCount, 64 + 64 + 5)
  assert.equal(r.status, "ready"); assert.ok(!/sk-LEAK/.test(String(r.note)))
  const rows = m.chunks.get(r.sourceId)!
  assert.equal(rows.length, 261); assert.equal(rows.filter((x) => x.embedding === null).length, 128)
  // daily limit hits mid-way: later batches are skipped, nothing is lost
  const m2 = mem(); let allowed = 2
  const r2 = await ingestSource({ store: m2.store, embed: async (t) => t.map(() => unit(1)), hasKey: () => true, allowEmbedCall: async () => allowed-- > 0 }, { userId: A, mediaId: M, kind: "document", title: "D", chunks: mk(64 * 5) })
  assert.deepEqual([r2.chunkCount, r2.embeddedCount, r2.status], [320, 128, "ready"]); assert.match(String(r2.note), /limit/i)
  // a throwing allowEmbedCall (billing outage) fails the source cleanly instead of crashing
  const r3 = await ingestSource({ store: mem().store, embed: async (t) => t.map(() => unit(1)), hasKey: () => true, allowEmbedCall: async () => { throw new Error("db") } }, { userId: A, mediaId: M, kind: "document", title: "D", chunks: mk(3) })
  assert.equal(r3.status, "failed")
})

test("ingest: a storage failure part-way marks the source FAILED with a friendly note (no raw database text) and never throws", async () => {
  for (const [boom, expect] of [[new Error('relation "agent_kb_chunks" does not exist'), /migration 32/], [Object.assign(new Error('duplicate key value violates unique constraint "agent_kb_sources_reel_uniq" Key (user_id)=(7)'), { code: "23505" }), /Indexing failed/], [new Error("invalid byte sequence for encoding \"UTF8\": 0x00"), /Indexing failed/]] as const) {
    const m = mem()
    const r = await ingestSource({ store: { ...m.store, replaceChunks: async () => { throw boom } }, embed: async (t) => t.map(() => unit(1)), hasKey: () => true }, { userId: A, mediaId: M, kind: "document", title: "D", chunks: mk(2) })
    assert.equal(r.status, "failed"); assert.match(String(r.note), expect)
    assert.ok(!/agent_kb_chunks|user_id|Key \(|0x00|duplicate/.test(String(r.note)), String(r.note))
    assert.equal([...m.sources.values()][0].status, "failed")
    assert.equal(m.log.at(-1), "status:failed")
  }
  // the status write itself failing must not throw either
  const m2 = mem()
  const r = await ingestSource({ store: { ...m2.store, replaceChunks: async () => { throw new Error("x") }, setSourceStatus: async () => { throw new Error("y") } }, embed: async () => [], hasKey: () => false }, { userId: A, mediaId: M, kind: "document", title: "D", chunks: mk(1) })
  assert.equal(r.status, "failed")
})

test("ingest: no key stores keyword-only chunks and says so; the embedder is never called", async () => {
  const m = mem(); let called = 0
  const r = await ingestSource({ store: m.store, embed: async (t) => { called++; return t.map(() => unit(1)) }, hasKey: () => false }, { userId: A, mediaId: M, kind: "document", title: "D", chunks: mk(10) })
  assert.deepEqual([called, r.embeddedCount, r.chunkCount, r.status], [0, 0, 10, "ready"]); assert.match(String(r.note), /keyword/i)
})

test("ingest: one input cannot make the owner id travel anywhere except as the first parameter; source upsert is keyed by (user, media, kind)", async () => {
  const seen: { text: string; values: any[] }[] = []
  const q = async (text: string, values: any[] = []) => { seen.push({ text, values }); return [{ id: "00000000-0000-0000-0000-000000000000" }] as any }
  const s = createRagStore(q as any)
  await s.upsertSource("7", { mediaId: M, kind: "reel_offer", title: "t" }); await s.upsertSource("7", { mediaId: M, kind: "reel_offer", title: "t" })
  await s.replaceChunks("7", { id: "00000000-0000-0000-0000-000000000000", mediaId: M, kind: "document", title: "t\u0000" }, [{ content: "a\u0000b", tokenEstimate: 1, embedding: null }])
  for (const { text, values } of seen) { assert.equal(String(values[0]), "7"); assert.ok(!/7/.test(text.replace(/\$\d+/g, ""))) }
  const rep = seen.find((x) => /replace_agent_chunks/.test(x.text))!
  assert.ok(/FROM agent_kb_sources WHERE user_id = \$1 AND id = \$2/.test(rep.text), "replace only runs for a source of this account (the owner comes from the source row)")
  assert.ok(!rep.values.flat().some((v: any) => typeof v === "string" && v.includes("\u0000")), "no NUL reaches SQL")
  assert.equal(EMBED_BATCH_SIZE, 64)
})

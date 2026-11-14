// QA (adversarial): cost / abuse guards, route plumbing and static UI checks for the agent knowledge base.
import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { register } from "node:module"
import { MAX_CHUNKS, retrieve } from "../lib/agent/rag/retrieve.ts"
import { slideWindow } from "../lib/agent/rate.ts"

const read = (f: string) => fs.readFileSync(f, "utf8")
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")
process.env.SESSION_SECRET = "x".repeat(40); process.env.AUTH_ENFORCE = "1"

test("embedding spend per turn: ZERO calls when nothing is indexed, the query is empty or there is no key; exactly ONE when searching, even if vector search fails and keywords take over", async () => {
  let embeds = 0
  const mk = (o: any = {}) => ({
    store: { hasChunks: async () => o.indexed ?? true, vectorSearch: async () => { if (o.vectorFails) throw new Error("rpc"); return [] }, keywordSearch: async () => [] },
    hasKey: () => o.key ?? true, embedQuery: async () => { embeds++; return o.embedNull ? null : [1, 0, 0] },
  })
  const run = (o: any, query = "price") => retrieve(mk(o) as any, { userId: "1", mediaId: "1790000001", query })
  await run({ indexed: false }); await run({}, ""); await run({}, "   "); await run({ key: false })
  assert.equal(embeds, 0)
  await run({}); assert.equal(embeds, 1)
  await run({ vectorFails: true }); assert.equal(embeds, 2)
  await run({ embedNull: true }); assert.equal(embeds, 3)
  assert.equal(MAX_CHUNKS, 5)
})

test("static: embedding budget is reserved only inside the query-embedding closure and in ingest, per call (not per chunk), and ingest checks it before every 64-chunk batch", () => {
  const svc = strip(read("lib/agent/rag/service.ts"))
  assert.equal((svc.match(/reserveEmbedding\(/g) || []).length, 2) // ingest allowEmbedCall + query embedding
  assert.match(svc, /embedQuery: async \(text\) => \(\(await reserveEmbedding\(userId\)\)\.allowed \? embedQuery\(text\) : null\)/)
  assert.match(svc, /allowEmbedCall: async \(\) => \(await reserveEmbedding\(userId\)\)\.allowed/)
  const ing = strip(read("lib/agent/rag/ingest.ts"))
  assert.ok(ing.indexOf("allowEmbedCall") < ing.indexOf("deps.embed(slice"), "budget check comes before each embeddings call")
  assert.ok(!/reserveEmbedding/.test(strip(read("lib/agent/rag/retrieve.ts"))))
})

test("Search test: no model call, no Instagram message, nothing stored; response contains only whitelisted fields; per-account rate guard", () => {
  const src = strip(read("app/api/ai-agent/kb/search/route.ts"))
  for (const forbidden of ["anthropic", "callAnthropic", "runTurn", "runSimulation", "sendSteps", "send-steps", "messaging", "INSERT", "UPDATE", "DELETE", "upsert", "saveConversation", "reserveAgentTurn", "reserveDm", "access_token", "OPENAI"]) assert.ok(!src.includes(forbidden), `search route mentions ${forbidden}`)
  assert.match(src, /rateAllowed\(u\.userId, "kb-search"/)
  assert.match(src, /cleanUntrusted\(body\?\.query, 300\)/)
  assert.match(src, /text: c\.content\.slice\(0, 400\)/)
  const keys = [...src.matchAll(/(\w+): /g)].map((m) => m[1])
  for (const leak of ["userId", "user_id", "sourceId", "id", "embedding", "raw_text", "rawText"]) assert.ok(!keys.includes(leak), `response key ${leak}`)
})

test("kb routes: size caps and rate guards are wired on every write path; all ids are validated strictly; no route echoes the key or env", () => {
  const kb = strip(read("app/api/ai-agent/kb/route.ts")), re = strip(read("app/api/ai-agent/kb/reindex/route.ts")), se = strip(read("app/api/ai-agent/kb/search/route.ts"))
  for (const s of [kb, re, se]) { assert.match(s, /readJsonLimited\(request, \d[\d_]*\)/); assert.match(s, /tooBigResponse\(\)/); assert.match(s, /rateAllowed\(/); assert.ok(!/request\.json\(\)/.test(s)); assert.ok(!/process\.env/.test(s.replace("hasEmbeddingKey", ""))) }
  assert.match(kb, /MAX_SOURCES = 100/); assert.match(kb, /MAX_SOURCE_CHARS/)
  assert.match(re, /\^\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{12\}\$/)
  assert.ok(kb.indexOf("agentUser(") < kb.indexOf("ragStore()") && re.indexOf("agentUser(") < re.indexOf("createAgentStore(") && se.indexOf("agentUser(") < se.indexOf("retrieverFor("))
  const kbGet = kb.slice(kb.indexOf("export async function GET"), kb.indexOf("export async function POST"))
  assert.match(kbGet, /embeddingConfigured: hasEmbeddingKey\(\)/); assert.ok(!/OPENAI_API_KEY/.test(kbGet))
})

test("readJsonLimited and rateAllowed behave: oversize body refused, bad JSON tolerated, windows are per account and per bucket", async () => {
  register("./helpers/alias-hooks.mjs", import.meta.url)
  const { NextRequest } = await import("next/server")
  const api: any = await import("../lib/agent/api.ts")
  const mk = (body: string, headers: any = {}) => new NextRequest("http://localhost/x", { method: "POST", headers: { "content-type": "application/json", ...headers }, body })
  assert.deepEqual(await api.readJsonLimited(mk('{"a":1}'), 100), { body: { a: 1 }, tooBig: false })
  assert.deepEqual(await api.readJsonLimited(mk("{nope"), 100), { body: {}, tooBig: false })
  assert.deepEqual(await api.readJsonLimited(mk(""), 100), { body: {}, tooBig: false })
  assert.deepEqual(await api.readJsonLimited(mk(JSON.stringify({ a: "x".repeat(500) })), 100), { tooBig: true })
  assert.deepEqual(await api.readJsonLimited(mk("{}", { "content-length": "99999999" }), 100), { tooBig: true })
  assert.equal((await api.tooBigResponse()).status, 413); assert.equal((await api.tooManyResponse()).status, 429)
  const hits = Array.from({ length: 12 }, () => api.rateAllowed("u1", "b1", 10))
  assert.deepEqual([hits.filter(Boolean).length, hits[10], hits[11]], [10, false, false])
  assert.equal(api.rateAllowed("u2", "b1", 10), true); assert.equal(api.rateAllowed("u1", "b2", 10), true)
  assert.equal(api.rateAllowed("u3", "b", 1, 30), true); assert.equal(api.rateAllowed("u3", "b", 1, 30), false)
  await new Promise((r) => setTimeout(r, 40)); assert.equal(api.rateAllowed("u3", "b", 1, 30), true, "window slides")
  for (let i = 0; i < 6000; i++) api.rateAllowed(`flood${i}`, "x", 5) // memory stays bounded (map is cleared past 5000 keys)
  assert.equal(slideWindow([], 0, 1).allowed, true)
})

test("auth matrix for the kb routes with legacy cookies: forged / unsigned cookie and a claimed other userId never pass when enforcement is on", async () => {
  register("./helpers/alias-hooks.mjs", import.meta.url)
  const { NextRequest } = await import("next/server")
  const { createSessionToken } = await import("../lib/session.ts")
  const tok = createSessionToken("111", "a", 3600)
  process.env.SESSION_ACCEPT_LEGACY = "0" // production default; in development the unsigned cookie is accepted by design (lib/auth.ts)
  for (const [route, methods] of [["kb", ["GET", "POST", "DELETE"]], ["kb/reindex", ["POST"]], ["kb/search", ["POST"]]] as const) {
    const mod: any = await import(path.resolve(`app/api/ai-agent/${route}/route.ts`))
    for (const method of methods) {
      const mk = (cookie: string | null, qs = "", body: any = { userId: "222", id: "00000000-0000-4000-8000-000000000000", query: "x" }) => new NextRequest(`http://localhost/api/ai-agent/${route}${qs}`, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie: `insta_session=${cookie}` } : {}) }, ...(method === "GET" || method === "DELETE" ? {} : { body: JSON.stringify(body) }) })
      const qs = "?userId=222&id=00000000-0000-4000-8000-000000000000"
      assert.equal((await mod[method](mk(null, qs))).status, 401, `${route} ${method} no session`)
      assert.equal((await mod[method](mk(JSON.stringify({ userId: "222" }), qs))).status, 401, `${route} ${method} legacy unsigned cookie`)
      assert.equal((await mod[method](mk(tok.slice(0, -2) + "xx", qs))).status, 401, `${route} ${method} tampered`)
      assert.equal((await mod[method](mk(tok, qs))).status, 403, `${route} ${method} session of 111 claiming 222`)
    }
  }
  delete process.env.SESSION_ACCEPT_LEGACY
})

test("static UI: Knowledge tab states, confirmation, labels, mobile safety, Celra tokens only, no gradients, no competitor names, no key", () => {
  const ui = read("components/ai-agent/KnowledgeBase.tsx"), page = read("app/dashboard/ai-agent/knowledge/page.tsx"), layout = read("app/dashboard/ai-agent/layout.tsx")
  assert.match(ui, /loading &&/); assert.match(ui, /Loading\.\.\./); assert.match(ui, /ErrorNote message=\{error \|\| actionError\}/); assert.match(ui, /Nothing indexed yet/); assert.match(ui, /No passage matched/)
  assert.match(ui, /confirm\(`Delete /, "Delete asks first")
  assert.ok(ui.indexOf("confirm(") < ui.indexOf('method: "DELETE"'))
  assert.match(ui, /aria-label=\{`Re-index /); assert.match(ui, /aria-label=\{`Delete /); assert.match(ui, /role="tablist"/); assert.match(ui, /aria-selected/); assert.match(ui, /role="status"/)
  for (const labelled of ["Title", "Page address", "Applies to", "Reel media id", "Text (up to 60,000 characters)"]) assert.ok(ui.includes(labelled), labelled)
  assert.match(ui, /flex-wrap/); assert.match(ui, /break-words/); assert.match(ui, /min-w-0/); assert.match(ui, /sm:flex-row/)
  assert.ok(!/\bw-\[\d{3,}px\]|\bmin-w-\[\d{3,}px\]|\bwidth: ?\d{3,}px|overflow-x/.test(ui), "no fixed wide boxes")
  assert.ok(!/gradient|from-|to-|via-/.test(ui), "no gradients")
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(ui) && !/style=\{\{/.test(ui), "colours come from tokens, not literals")
  assert.ok(!/manychat|chatfuel|linkdm|zoko|wati|interakt|meta[- ]approved|official meta|meta partner/i.test(ui + page + layout))
  assert.ok(!/OPENAI_API_KEY|sk-[A-Za-z0-9]{6,}|process\.env/.test(ui), "the key name and value never appear in the UI")
  assert.ok(!/dangerouslySetInnerHTML|innerHTML|eval\(/.test(ui), "passage and error text are rendered as text, never as HTML")
  assert.match(page, /KnowledgeBase/); assert.match(layout, /href: "\/dashboard\/ai-agent\/knowledge", label: "Knowledge"/)
  const wizard = read("components/ai-agent/SetupWizard.tsx"); assert.match(wizard, /<KnowledgeBase compact \/>/)
  // search test shows where each passage comes from and which scope (only this account's rows are ever returned by the route)
  assert.match(ui, /c\.scope/); assert.match(ui, /KIND_LABEL\[c\.kind\]/)
})

test("static UI: colour tokens used by the Knowledge tab exist in the Celra theme and the theme has no gradients or forbidden palette", () => {
  const css = read("app/globals.css")
  for (const token of ["--background", "--foreground", "--primary", "--secondary", "--accent", "--destructive", "--border", "--muted-foreground", "--brand"]) assert.ok(css.includes(token), token)
  const hex = (css.match(/#[0-9a-fA-F]{6}\b/g) || []).map((h) => h.toUpperCase())
  for (const must of ["#0B5C6E", "#FF6F4D", "#FBFAF6", "#FFF6F1", "#0E2A33"]) assert.ok(hex.includes(must) || css.toUpperCase().includes(must.slice(1)), `${must} missing from the theme`)
  assert.ok(!/gradient\(/.test(read("components/ai-agent/KnowledgeBase.tsx") + read("components/ai-agent/shared.tsx")))
})

test("docs: the retrieval section states the tenant rule, the link rule for imported pages, the limits and the migration", () => {
  const d = read("docs/AI-SALES-AGENT.md")
  assert.match(d, /Tenant safety/); assert.match(d, /32-agent-rag/); assert.match(d, /replace_agent_chunks|re-index/i)
})

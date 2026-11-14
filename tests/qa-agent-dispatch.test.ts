// QA (adversarial): AiSend payload vs the real contract, retry decisions, idempotent ids, SSRF guard.
import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import { aiSendBodyFromEventData, buildLeadEventData, buildTestLeadData, leadEventId, hashIgsid } from "../lib/agent/payload.ts"
import { buildEnvelope, decideAfterAttempt, nextRetryDelaySec, shapePayload, MAX_ATTEMPTS, DISABLE_AFTER_DEAD, maskSecret } from "../lib/webhooks/policy.ts"
import { checkWebhookUrl, isBlockedIp, resolvePublicAddress } from "../lib/webhooks/ssrf.ts"
import { normalizeAiSendBaseUrl, aiSendIngestUrl } from "../lib/agent/aisend.ts"
import { safePost } from "../lib/webhooks/safe-fetch.ts"

const lead = (o: any = {}) => ({ userId: 7, igsid: "17841400000000001", contactId: "c-1", name: "Asha", phoneE164: "+919876501234", email: null, interest: "Hair PRP", mediaId: "179000001", consentGiven: true, consentAt: "2026-11-15T10:00:00.000Z", consentText: "line", score: 95, ...o })

// Fields AiSend's POST /api/leads/ingest reads (src/app/api/leads/ingest/route.ts): the body must only use these keys, with these types.
const AISEND_KEYS = new Set(["source", "name", "first_name", "firstName", "last_name", "lastName", "phone", "email", "company_name", "company", "campaign", "adset", "ad_id", "ad", "ad_headline", "ad_name", "interest", "procedure_interest", "product_interest", "utm_source", "utm_medium", "utm_campaign", "gclid", "consent", "extra"])

test("AiSend body: only keys AiSend reads, right types, E.164 phone, boolean consent, extra is an object", () => {
  const b = aiSendBodyFromEventData(buildLeadEventData(lead()))
  for (const k of Object.keys(b)) assert.ok(AISEND_KEYS.has(k), `unknown key ${k}`)
  assert.match(String(b.phone), /^\+91[6-9]\d{9}$/)
  assert.equal(typeof b.consent, "boolean")
  assert.equal(b.consent, true)
  assert.equal(typeof b.extra, "object")
  assert.equal(b.source, "instagram_dm")
  assert.ok(!JSON.stringify(b).includes("17841400000000001")) // raw Instagram id is never sent
})

test("AiSend body: email-only lead has no phone key; AiSend accepts phone OR email", () => {
  const b = aiSendBodyFromEventData(buildLeadEventData(lead({ phoneE164: null, email: "a@b.com" })))
  assert.equal("phone" in b, false)
  assert.equal(b.email, "a@b.com")
})

test("AiSend body: consent is true ONLY when consent_given === true (never truthy strings)", () => {
  for (const v of ["true", 1, "yes", {}, null, undefined, "false", 0]) assert.equal(aiSendBodyFromEventData({ consent_given: v, phone: "+919876501234" }).consent, false, String(v))
  assert.equal(aiSendBodyFromEventData({ consent_given: true }).consent, true)
})

test("AiSend body: hostile / huge values are truncated or dropped, never crash", () => {
  const b = aiSendBodyFromEventData({ name: "n".repeat(1000), phone: "9".repeat(100), email: "e".repeat(1000), interest: "i".repeat(1000), source_media_id: {}, score: "95", consent_text: 5, contact_id: ["x"] })
  assert.ok(String(b.name).length <= 120 && String(b.phone).length <= 20 && String(b.email).length <= 254 && String(b.interest).length <= 300)
  assert.equal((b.extra as any).lead_score, null)
  assert.equal((b.extra as any).celra_media_id, null)
  assert.doesNotThrow(() => aiSendBodyFromEventData({}))
  assert.doesNotThrow(() => JSON.stringify(aiSendBodyFromEventData({ name: "\ud800" })))
})

test("AiSend contract check against the sibling repo: the fields we send are read there (skipped if repo absent)", { skip: !fs.existsSync("/home/claude/crisrosbert/aisend-/src/app/api/leads/ingest/route.ts") }, () => {
  const src = fs.readFileSync("/home/claude/crisrosbert/aisend-/src/app/api/leads/ingest/route.ts", "utf8")
  for (const k of ["body.source", "body.name", "body.phone", "body.email", "body.interest", "body.campaign", "body.consent", "body.extra"]) assert.ok(src.includes(k), k)
  assert.ok(src.includes("x-api-key"))
  assert.ok(src.includes("typeof body.consent === 'boolean'"))
  const ing = fs.readFileSync("/home/claude/crisrosbert/aisend-/src/lib/leads/ingest.ts", "utf8")
  assert.ok(ing.includes("clean(input.email, 160)")) // AiSend caps email at 160; ours allows 254 (see report)
})

test("test lead: email only, consent false, never a phone", () => {
  const b = aiSendBodyFromEventData(buildTestLeadData(7))
  assert.equal("phone" in b, false)
  assert.equal(b.consent, false)
  assert.equal(b.email, "celra-test@example.com")
})

test("idempotency ids: deterministic, UUID-shaped, differ per person/reel/kind/account", () => {
  const a = leadEventId(1, "ig", "m", "whatsapp")
  assert.equal(a, leadEventId(1, "ig", "m", "whatsapp"))
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  for (const other of [leadEventId(2, "ig", "m", "whatsapp"), leadEventId(1, "ig2", "m", "whatsapp"), leadEventId(1, "ig", "m2", "whatsapp"), leadEventId(1, "ig", "m", "email")]) assert.notEqual(a, other)
  assert.equal(leadEventId("1", "ig", "m", "whatsapp"), a) // number vs string user id
  // Instagram ids and media ids are digits only (validated), so ":"-joined inputs cannot collide in practice.
  assert.notEqual(leadEventId(1, "12", "3", "whatsapp"), leadEventId(1, "1", "23", "whatsapp"))
  assert.notEqual(hashIgsid(1, "23"), hashIgsid(12, "3"))
})

test("shapePayload(aisend): the API key (secret) never appears in the body; other presets unchanged", () => {
  const env = buildEnvelope("lead.whatsapp_captured" as any, buildLeadEventData(lead()), leadEventId(7, "ig", "m", "whatsapp"))
  const body = JSON.stringify(shapePayload("aisend", env, "SUPER-SECRET-KEY-123"))
  assert.ok(!body.includes("SUPER-SECRET-KEY-123"))
  assert.deepEqual(shapePayload("generic", env, "x"), env)
  assert.ok(!JSON.stringify(env).includes("SUPER-SECRET"))
  assert.ok(!maskSecret("SUPER-SECRET-KEY-123").includes("SECRET-KEY"))
})

test("retry decisions: aisend 4xx is permanent except 408/429; 5xx, timeouts and network errors retry; schedule is bounded", () => {
  for (const s of [400, 401, 403, 404, 409, 410, 413, 422]) assert.equal(decideAfterAttempt("aisend", { ok: false, status: s }, 1).kind, "dead", String(s))
  for (const s of [408, 429, 500, 502, 503, 504]) assert.equal(decideAfterAttempt("aisend", { ok: false, status: s }, 1).kind, "retry", String(s))
  assert.equal(decideAfterAttempt("aisend", { ok: false }, 1).kind, "retry") // timeout / DNS failure: no status
  assert.equal(decideAfterAttempt("aisend", { ok: false, permanent: true }, 1).kind, "dead") // SSRF-blocked
  assert.equal(decideAfterAttempt("aisend", { ok: true, status: 200 }, 1).kind, "delivered")
  assert.equal(decideAfterAttempt("generic", { ok: false, status: 401 }, 1).kind, "retry") // old behaviour kept
  assert.equal(decideAfterAttempt("sheets", { ok: false, status: 404 }, 1).kind, "retry")
  assert.equal(decideAfterAttempt("aisend", { ok: false, status: 500 }, MAX_ATTEMPTS).kind, "dead")
  let prev = 0
  for (let a = 1; a < MAX_ATTEMPTS; a++) { const d = nextRetryDelaySec(a)!; assert.ok(d > prev); prev = d }
  assert.ok(DISABLE_AFTER_DEAD >= 3)
})

test("source: no console.* line in the dispatch path prints a secret, key, phone, email or message text", () => {
  for (const f of ["lib/webhooks/events.ts", "lib/webhooks/safe-fetch.ts", "lib/agent/runtime.ts", "lib/agent/engine.ts", "lib/agent/api.ts", "app/api/ai-agent/aisend/route.ts", "app/api/ai-agent/aisend/test/route.ts"]) {
    const lines = fs.readFileSync(f, "utf8").split("\n").filter((l) => /console\.(log|error|warn|info)/.test(l))
    for (const l of lines) assert.ok(!/secret|apiKey|api_key|x-api-key|phone|email|userText|\.text\b|body\b|payload/i.test(l.replace(/\/\/.*$/, "")), `${f}: ${l.trim()}`)
  }
})

test("source: the x-api-key header is only added for the aisend preset", () => {
  const src = fs.readFileSync("lib/webhooks/events.ts", "utf8")
  assert.equal((src.match(/"x-api-key"/g) || []).length, 1)
  assert.ok(/ep\.preset === "aisend" \? \{ "x-api-key": secret \}/.test(src))
})

// ---------- SSRF ----------
const HOSTILE = [
  "http://aisend.example.com", "https://127.0.0.1", "https://127.1", "https://2130706433", "https://0x7f000001", "https://0177.0.0.1", "https://０.０.０.０", "https://１２７.０.０.１",
  "https://[::1]", "https://[::]", "https://[::ffff:127.0.0.1]", "https://[::ffff:7f00:1]", "https://[0:0:0:0:0:ffff:7f00:1]", "https://[64:ff9b::7f00:1]", "https://[2002:7f00:1::]", "https://[fd00::1]", "https://[fe80::1]", "https://[::ffff:169.254.169.254]",
  "https://169.254.169.254/latest/meta-data", "https://10.0.0.5", "https://172.16.0.1", "https://192.168.1.1", "https://100.64.0.1", "https://0.0.0.0", "https://224.0.0.1", "https://255.255.255.255",
  "https://localhost", "https://LOCALHOST", "https://foo.localhost", "https://metadata.google.internal", "https://printer.local", "https://x.localdomain", "https://x.home.arpa",
  "https://user:pass@aisend.example.com", "https://aisend.example.com:8443", "https://aisend.example.com:80", "ftp://aisend.example.com", "file:///etc/passwd", "javascript:alert(1)", "gopher://x", "", "not a url", "https://",
]
test("SSRF syntax guard rejects every hostile form", () => {
  for (const u of HOSTILE) {
    const n = normalizeAiSendBaseUrl(u)
    assert.equal(n.ok, false, `accepted: ${u} -> ${JSON.stringify(n)}`)
    assert.equal(aiSendIngestUrl(u), null)
  }
  for (const nonStr of [null, undefined, 5, {}, []]) assert.equal(normalizeAiSendBaseUrl(nonStr as any).ok, false)
})

test("SSRF: trailing-dot and mixed-case localhost forms are rejected at save time too", () => {
  for (const u of ["https://localhost./", "https://LocalHost.", "https://foo.localhost./", "https://metadata.google.internal./", "https://127.0.0.1./"]) {
    assert.equal(normalizeAiSendBaseUrl(u).ok, false, u)
  }
})

test("SSRF: acceptable base URLs are normalised; query and fragment are refused", () => {
  assert.deepEqual(normalizeAiSendBaseUrl("https://app.aisend.example/"), { ok: true, base: "https://app.aisend.example" })
  assert.equal(aiSendIngestUrl("https://app.aisend.example/sub/"), "https://app.aisend.example/sub/api/leads/ingest")
  assert.equal(normalizeAiSendBaseUrl("https://app.aisend.example/?key=abc").ok, false)
  assert.equal(normalizeAiSendBaseUrl("https://app.aisend.example/#x").ok, false)
  assert.equal(normalizeAiSendBaseUrl("https://" + "a".repeat(2100) + ".com").ok, false)
})

test("SSRF DNS: every resolved address must be public; rebinding-style mixed answers and IPv6 are blocked; a pinned address is returned", async () => {
  const mk = (...addrs: string[]) => async () => addrs.map((a) => ({ address: a, family: a.includes(":") ? 6 : 4 }))
  assert.equal((await resolvePublicAddress("a.example", mk("93.184.216.34"))).ok, true)
  for (const bad of [["127.0.0.1"], ["93.184.216.34", "10.0.0.1"], ["10.0.0.1", "93.184.216.34"], ["::1"], ["::ffff:10.0.0.1"], ["fe80::1"], ["93.184.216.34", "169.254.169.254"], ["64:ff9b::a00:1"], ["2002:a00:1::"]]) {
    assert.equal((await resolvePublicAddress("a.example", mk(...bad))).ok, false, bad.join(","))
  }
  assert.equal((await resolvePublicAddress("a.example", async () => [])).ok, false)
  assert.equal((await resolvePublicAddress("a.example", async () => { throw new Error("nx") })).ok, false)
  assert.equal(isBlockedIp("not-an-ip"), true)
})

test("SSRF: safePost refuses blocked targets without any network call and marks them permanent", async () => {
  for (const u of ["https://127.0.0.1/x", "https://localhost/x", "http://example.com/x", "https://169.254.169.254/x", "https://[::1]/x"]) {
    const r = await safePost(u, "{}", {})
    assert.equal(r.ok, false, u)
    assert.equal(r.permanent, true, u)
  }
})

test("source: safePost never follows redirects and pins the validated address", () => {
  const src = fs.readFileSync("lib/webhooks/safe-fetch.ts", "utf8")
  assert.ok(!/location/i.test(src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")))
  assert.ok(src.includes("host: target.address") && src.includes("servername: url.hostname"))
})

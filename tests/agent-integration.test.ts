// Unit tests: routing, lead payloads, AiSend body, retry decisions with a fake receiver, tenant isolation, wizard, overview, rate guard.
import test from "node:test"
import assert from "node:assert/strict"
import { isAgentRule, routeIncomingDm } from "../lib/agent/routing.ts"
import { LEAD_EVENT_EMAIL, LEAD_EVENT_WHATSAPP, aiSendBodyFromEventData, buildLeadEventData, buildTestLeadData, hashIgsid, leadEventId } from "../lib/agent/payload.ts"
import { MAX_ATTEMPTS, WEBHOOK_EVENTS, WEBHOOK_PRESETS, buildEnvelope, decideAfterAttempt, isWebhookEvent, nextRetryDelaySec, shapePayload } from "../lib/webhooks/policy.ts"
import { createAgentStore, sanitizeKnowledgeInput } from "../lib/agent/store.ts"
import { newAgentState } from "../lib/agent/engine.ts"
import { computeWizard } from "../lib/agent/wizard.ts"
import { aggregateOverview } from "../lib/agent/overview.ts"
import { slideWindow } from "../lib/agent/rate.ts"
import { checkWebhookUrl } from "../lib/webhooks/ssrf.ts"
import { normalizeAiSendBaseUrl, aiSendIngestUrl } from "../lib/agent/aisend.ts"

// ---------- routing ----------
const base = { humanHandled: false, withinWindow: true, triggerType: "keyword", hasRefRule: false, hasQuickReplyPayload: false, agentEnabled: true, agentConversation: { status: "active" } }

test("isAgentRule only for response_kind ai_agent", () => {
  assert.equal(isAgentRule({ response_kind: "ai_agent" }), true)
  for (const c of [null, undefined, {}, { response_kind: "x" }, "ai_agent", { message: "hi" }]) assert.equal(isAgentRule(c), false)
})

test("routing: active agent conversation + text DM goes to the agent", () => {
  assert.deepEqual(routeIncomingDm(base), { route: "agent" })
})

test("routing: human_handled wins over everything (agent stays silent)", () => {
  assert.deepEqual(routeIncomingDm({ ...base, humanHandled: true }), { route: "skip", reason: "human_handled" })
})

test("routing: outside the 24h window nothing is sent", () => {
  assert.deepEqual(routeIncomingDm({ ...base, withinWindow: false }), { route: "skip", reason: "outside_window" })
})

test("routing: no/closed conversation, postback, ref link, quick reply and disabled agent keep the old behaviour", () => {
  assert.equal(routeIncomingDm({ ...base, agentConversation: null }).route, "fallthrough")
  for (const status of ["ended", "handoff"]) assert.deepEqual(routeIncomingDm({ ...base, agentConversation: { status } }), { route: "fallthrough", reason: "conversation_closed" })
  assert.deepEqual(routeIncomingDm({ ...base, triggerType: "postback" }), { route: "fallthrough", reason: "not_a_text_message" })
  assert.deepEqual(routeIncomingDm({ ...base, hasRefRule: true }), { route: "fallthrough", reason: "ref_link" })
  assert.deepEqual(routeIncomingDm({ ...base, hasQuickReplyPayload: true }), { route: "fallthrough", reason: "quick_reply" })
  assert.deepEqual(routeIncomingDm({ ...base, agentEnabled: false }), { route: "fallthrough", reason: "agent_disabled" })
})

// ---------- payloads ----------
const lead = { userId: 7, igsid: "17841400000000001", contactId: "c-1", name: "Asha", phoneE164: "+919876501234", email: null, interest: "Hair PRP offer", mediaId: "179000001", consentGiven: true, consentAt: "2026-11-15T10:00:00.000Z", consentText: "To send...", score: 95 }

test("event data: carries E.164 phone, consent proof, score and a hashed (not raw) igsid", () => {
  const d = buildLeadEventData(lead)
  assert.equal(d.phone, "+919876501234")
  assert.equal(d.consent_given, true)
  assert.equal(d.consent_text, "To send...")
  assert.equal(d.score, 95)
  assert.equal(d.source_media_id, "179000001")
  assert.equal(d.interest, "Hair PRP offer")
  assert.equal(d.igsid_hash, hashIgsid(7, "17841400000000001"))
  assert.match(String(d.igsid_hash), /^[0-9a-f]{32}$/)
  assert.ok(!JSON.stringify(d).includes("17841400000000001"))
  assert.notEqual(hashIgsid(8, "17841400000000001"), d.igsid_hash) // different account, different hash
})

test("AiSend body: exactly the fields AiSend reads, source instagram_dm, extra holds the Celra metadata", () => {
  const body = aiSendBodyFromEventData(buildLeadEventData(lead))
  assert.deepEqual(body, {
    source: "instagram_dm", campaign: "celra_ai_agent", consent: true, name: "Asha", phone: "+919876501234", interest: "Hair PRP offer",
    extra: { celra_media_id: "179000001", lead_score: 95, consent_text: "To send...", consent_at: "2026-11-15T10:00:00.000Z", ig_contact_id: "c-1", source: "celra_ai_agent" },
  })
  assert.match(String(body.phone), /^\+91[6-9]\d{9}$/)
})

test("AiSend body: email-only lead has no phone key; consent false path stays false and never claims consent", () => {
  const emailOnly = aiSendBodyFromEventData(buildLeadEventData({ ...lead, phoneE164: null, email: "asha@example.com" }))
  assert.equal("phone" in emailOnly, false)
  assert.equal(emailOnly.email, "asha@example.com")
  const noConsent = aiSendBodyFromEventData(buildLeadEventData({ ...lead, consentGiven: false, consentAt: null, consentText: null }))
  assert.equal(noConsent.consent, false)
  assert.equal((noConsent.extra as any).consent_at, null)
  assert.equal(aiSendBodyFromEventData({}).consent, false) // missing data never becomes consent
})

test("AiSend body: no secrets, tokens or raw Instagram ids; long fields are clamped", () => {
  const body = aiSendBodyFromEventData({ ...buildLeadEventData(lead), interest: "x".repeat(900), api_key: "SECRET", access_token: "TOKEN" })
  const json = JSON.stringify(body)
  assert.ok(!/SECRET|TOKEN|17841400000000001/.test(json))
  assert.equal((body.interest as string).length, 300)
})

test("test lead: email only, consent false, clearly labelled (never a phone: receivers may message every new lead)", () => {
  const b = aiSendBodyFromEventData(buildTestLeadData(7))
  assert.equal("phone" in b, false)
  assert.equal(b.consent, false)
  assert.equal(b.email, "celra-test@example.com")
})

test("idempotency id: stable per (account, person, reel, kind) and UUID shaped", () => {
  const a = leadEventId(7, "ig1", "m1", "whatsapp")
  assert.equal(a, leadEventId(7, "ig1", "m1", "whatsapp"))
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  for (const other of [leadEventId(8, "ig1", "m1", "whatsapp"), leadEventId(7, "ig2", "m1", "whatsapp"), leadEventId(7, "ig1", "m2", "whatsapp"), leadEventId(7, "ig1", "m1", "email")]) assert.notEqual(a, other)
})

test("webhook policy: new events and the aisend preset are registered; aisend shapes the envelope into the AiSend body", () => {
  assert.ok(isWebhookEvent(LEAD_EVENT_WHATSAPP) && isWebhookEvent(LEAD_EVENT_EMAIL))
  assert.ok(WEBHOOK_EVENTS.includes("lead_captured")) // old events unchanged
  assert.ok((WEBHOOK_PRESETS as readonly string[]).includes("aisend"))
  const env = buildEnvelope("lead.whatsapp_captured", buildLeadEventData(lead), leadEventId(7, "ig", "m", "whatsapp"))
  assert.deepEqual(shapePayload("aisend", env, "SECRET-KEY"), aiSendBodyFromEventData(env.data))
  assert.ok(!JSON.stringify(shapePayload("aisend", env, "SECRET-KEY")).includes("SECRET-KEY"))
  assert.deepEqual(shapePayload("generic", env, "k"), env) // generic receivers get the whole signed envelope
})

// ---------- retry with a fake receiver ----------
/** Drives the same decision function the delivery engine uses, against a fake receiver that answers a queue of statuses. */
async function deliverAgainstFake(preset: string, statuses: number[]) {
  const fetchLog: number[] = []
  let attempts = 0
  const delays: number[] = []
  for (;;) {
    const status = statuses[Math.min(attempts, statuses.length - 1)]
    attempts++
    fetchLog.push(status)
    const d = decideAfterAttempt(preset, { ok: status >= 200 && status < 300, status }, attempts)
    if (d.kind === "delivered") return { outcome: "delivered", attempts, delays }
    if (d.kind === "dead") return { outcome: "dead", attempts, delays }
    delays.push(d.delaySec)
  }
}

test("retry: aisend 500, 500, 200 is delivered on attempt 3 after 1m then 5m", async () => {
  assert.deepEqual(await deliverAgainstFake("aisend", [500, 500, 200]), { outcome: "delivered", attempts: 3, delays: [60, 300] })
})

test("retry: aisend 401 (wrong key) and 400 are dead immediately; 429 and 408 are retried", async () => {
  assert.equal((await deliverAgainstFake("aisend", [401])).attempts, 1)
  assert.equal((await deliverAgainstFake("aisend", [400])).outcome, "dead")
  assert.deepEqual(await deliverAgainstFake("aisend", [429, 200]), { outcome: "delivered", attempts: 2, delays: [60] })
  assert.equal((await deliverAgainstFake("aisend", [408, 200])).outcome, "delivered")
})

test("retry: persistent 503 gives up after the full schedule (MAX_ATTEMPTS) and then is dead", async () => {
  const r = await deliverAgainstFake("aisend", [503])
  assert.equal(r.outcome, "dead")
  assert.equal(r.attempts, MAX_ATTEMPTS)
  assert.deepEqual(r.delays, [60, 300, 1800, 7200, 43200])
})

test("retry: generic and sheets endpoints keep the old behaviour (even 4xx is retried), blocked URLs are permanent", () => {
  assert.deepEqual(decideAfterAttempt("generic", { ok: false, status: 401 }, 1), { kind: "retry", delaySec: 60 })
  assert.deepEqual(decideAfterAttempt("sheets", { ok: false, status: 404 }, 2), { kind: "retry", delaySec: 300 })
  assert.deepEqual(decideAfterAttempt("generic", { ok: false, permanent: true }, 1), { kind: "dead" })
  assert.deepEqual(decideAfterAttempt("generic", { ok: false }, 6), { kind: "dead" })
  assert.equal(nextRetryDelaySec(1), 60)
})

test("connector URL: https only, public host, normalised to /api/leads/ingest", () => {
  assert.equal(aiSendIngestUrl("https://app.aisend.example"), "https://app.aisend.example/api/leads/ingest")
  assert.equal(aiSendIngestUrl("https://app.aisend.example/"), "https://app.aisend.example/api/leads/ingest")
  assert.equal(aiSendIngestUrl("https://app.aisend.example/base/"), "https://app.aisend.example/base/api/leads/ingest")
  for (const bad of ["http://app.aisend.example", "https://127.0.0.1", "https://localhost", "https://10.0.0.1", "ftp://x.com", "not a url", "", "https://user:pw@x.example", "https://x.example/?key=abc"]) {
    assert.equal(normalizeAiSendBaseUrl(bad).ok, false, bad)
  }
  assert.equal(checkWebhookUrl(aiSendIngestUrl("https://app.aisend.example")!).ok, true)
})

// ---------- tenant isolation ----------
test("store: EVERY statement is scoped to the calling account (user_id = $1 or a user_id column insert, first param is the user id)", async () => {
  const seen: { text: string; values: any[] }[] = []
  const q = async (text: string, values: any[] = []) => { seen.push({ text, values }); return [{ id: 1, status: "active", state: {} }] as any[] }
  const s = createAgentStore(q as any)
  const U = "42"
  const k = { mediaId: "17900000001", title: "t", caption: "c", offer: "o", faqs: [] }
  await s.listKnowledge(U); await s.getKnowledge(U, "m"); await s.upsertKnowledge(U, k, true); await s.setKnowledgeActive(U, "m", false); await s.deleteKnowledge(U, "m")
  await s.getConversation(U, "ig"); await s.startConversation(U, "ig", "m", newAgentState()); await s.saveConversation(U, "ig", 0, newAgentState())
  await s.setConversationStatus(U, "ig", "ended"); await s.listConversations(U); await s.takeOver(U, "ig"); await s.getMessages(U, "ig")
  await s.getSettings(U); await s.saveSettings(U, { enabled: true })
  await s.getContact(U, "ig"); await s.applyLead(U, "ig", { status: "engaged", score: 30, mediaId: "m" }); await s.listLeads(U, "wa_lead")
  await s.claimLeadDispatch(U, "ig", "m", "whatsapp")
  await s.getConnector(U); await s.saveConnector(U, "https://x.example/api/leads/ingest", "enc", true, ["lead.whatsapp_captured"]); await s.removeConnector(U); await s.listAgentRules(U)
  assert.ok(seen.length >= 25)
  for (const { text, values } of seen) {
    assert.equal(values[0], U, text)
    assert.ok(/user_id\s*=\s*\$1/.test(text) || /\(user_id,/.test(text), `no user scope in: ${text}`)
  }
  // writes that target a row by id also carry the user id
  const upd = seen.find((x) => /UPDATE webhook_endpoints SET url/.test(x.text))
  assert.ok(upd && /AND user_id = \$1/.test(upd.text))
})

test("store: two accounts never share a conversation key (same igsid, different user -> different params)", async () => {
  const seen: any[][] = []
  const s = createAgentStore((async (_t: string, v: any[] = []) => { seen.push(v); return [] }) as any)
  await s.getConversation("1", "ig"); await s.getConversation("2", "ig")
  assert.deepEqual(seen.map((v) => v[0]), ["1", "2"])
})

test("store: compare-and-set conversation save drops a racing duplicate", async () => {
  let rows: any[] = [{ id: 1 }]
  const s = createAgentStore((async () => rows) as any)
  assert.equal(await s.saveConversation("1", "ig", 3, newAgentState()), true)
  rows = []
  assert.equal(await s.saveConversation("1", "ig", 3, newAgentState()), false)
})

test("store: claimLeadDispatch is true only for the first claim", async () => {
  let n = 0
  const s = createAgentStore((async () => (n++ === 0 ? [{ id: 1 }] : [])) as any)
  assert.equal(await s.claimLeadDispatch("1", "ig", "m", "whatsapp"), true)
  assert.equal(await s.claimLeadDispatch("1", "ig", "m", "whatsapp"), false)
})

test("sanitizeKnowledgeInput: media id must be numeric, fields are capped, junk FAQs dropped", () => {
  assert.equal(sanitizeKnowledgeInput({ mediaId: "abc" }), null)
  assert.equal(sanitizeKnowledgeInput({ mediaId: "1; DROP TABLE" }), null)
  const k = sanitizeKnowledgeInput({ mediaId: " 17900000001 ", title: "t".repeat(500), offer: "o".repeat(5000), faqs: [{ q: "a", a: "b" }, { q: 1 }, null, ...Array(40).fill({ q: "q", a: "a" })] })!
  assert.equal(k.mediaId, "17900000001"); assert.equal(k.title.length, 120); assert.equal(k.offer.length, 1000); assert.equal(k.faqs.length, 20)
})

// ---------- wizard / overview / rate ----------
test("wizard: step done flags, next step and completion", () => {
  const none = computeWizard({ connectorConfigured: false, connectorSkipped: false, knowledgeCount: 0, settingsSaved: false, ruleActive: false, agentEnabled: false })
  assert.deepEqual(none.steps.map((s) => s.done), [false, false, false, false])
  assert.equal(none.nextStep, 1); assert.equal(none.complete, false)
  const skipped = computeWizard({ connectorConfigured: false, connectorSkipped: true, knowledgeCount: 1, settingsSaved: false, ruleActive: false, agentEnabled: false })
  assert.deepEqual(skipped.steps.map((s) => s.done), [true, true, false, false]); assert.equal(skipped.nextStep, 3)
  assert.equal(computeWizard({ connectorConfigured: true, connectorSkipped: false, knowledgeCount: 2, settingsSaved: true, ruleActive: true, agentEnabled: false }).steps[3].done, false) // rule exists but agent switched off
  const all = computeWizard({ connectorConfigured: true, connectorSkipped: false, knowledgeCount: 2, settingsSaved: true, ruleActive: true, agentEnabled: true })
  assert.equal(all.complete, true); assert.equal(all.nextStep, null); assert.equal(all.doneCount, 4)
})

test("overview: counts today's conversations, leads by kind, handoffs, score buckets, last 10 newest first", () => {
  const now = new Date("2026-11-15T12:00:00Z")
  const convs = [
    { status: "active", startedAt: "2026-11-15T01:00:00Z", updatedAt: "2026-11-15T02:00:00Z" },
    { status: "handoff", startedAt: "2026-11-14T23:59:00Z", updatedAt: "2026-11-15T02:00:00Z" },
    { status: "ended", startedAt: "2026-11-15T09:00:00Z", updatedAt: "2026-11-15T09:30:00Z" },
    { status: "active", startedAt: "garbage", updatedAt: "x" },
  ]
  const leads = Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, igsid: `i${i}`, name: null, status: i % 3 === 0 ? "wa_lead" : i % 3 === 1 ? "email_lead" : "engaged", score: i % 3 === 0 ? 95 : i % 3 === 1 ? 60 : 30, updatedAt: new Date(Date.UTC(2026, 10, 1 + i)).toISOString() }))
  const o = aggregateOverview(convs, leads, now)
  assert.equal(o.conversationsToday, 2); assert.equal(o.activeConversations, 2); assert.equal(o.handoffs, 1)
  assert.equal(o.whatsappLeads, 4); assert.equal(o.emailLeads, 4)
  assert.deepEqual(o.scoreDistribution, { "0-24": 0, "25-49": 4, "50-74": 4, "75-100": 4 })
  assert.equal(o.lastLeads.length, 10); assert.equal(o.lastLeads[0].id, "c11")
  const empty = aggregateOverview([], [], now)
  assert.equal(empty.conversationsToday, 0); assert.deepEqual(empty.lastLeads, [])
})

test("rate guard: allows up to max per window, then blocks, then frees as stamps age out", () => {
  let stamps: number[] = []
  for (let i = 0; i < 3; i++) { const r = slideWindow(stamps, 1000 + i, 3, 60_000); assert.equal(r.allowed, true); stamps = r.stamps }
  const blocked = slideWindow(stamps, 1010, 3, 60_000)
  assert.equal(blocked.allowed, false); assert.equal(blocked.stamps.length, 3)
  assert.equal(slideWindow(blocked.stamps, 61_001, 3, 60_000).allowed, true)
})

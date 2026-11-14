// QA (adversarial, needs a real Postgres): runs the REAL SQL in lib/agent/store.ts against a throwaway database.
// Skipped unless QA_PG_HOST (socket dir or host) is set. Prepare the db with migrations 13, 28, 31 plus stub users/conversations/messages/automations.
import test from "node:test"
import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { createAgentStore } from "../lib/agent/store.ts"
import { newAgentState } from "../lib/agent/engine.ts"

const host = process.env.QA_PG_HOST
const skip = host ? false : "set QA_PG_HOST (and QA_PG_PORT) to run the real-SQL tests"

test("real SQL: tenant isolation, CAS, idempotent dispatch, injection-safe parameters", { skip }, async () => {
  const require = createRequire(import.meta.url)
  const { Pool } = require("pg")
  const pool = new Pool({ host, port: Number(process.env.QA_PG_PORT || 5432), user: process.env.QA_PG_USER || "postgres", database: process.env.QA_PG_DB || "qa" })
  const q = async (text: string, values: any[] = []) => (await pool.query(text, values)).rows
  const store = createAgentStore(q as any)
  const A = 910001, B = 910002
  try {
    await q(`DELETE FROM media_knowledge WHERE user_id IN ($1,$2)`, [A, B])
    await q(`DELETE FROM agent_conversations WHERE user_id IN ($1,$2)`, [A, B])
    await q(`DELETE FROM contacts WHERE user_id IN ($1,$2)`, [A, B])
    await q(`DELETE FROM lead_events WHERE user_id IN ($1,$2)`, [A, B])
    await q(`DELETE FROM webhook_endpoints WHERE user_id IN ($1,$2)`, [A, B])
    await q(`DELETE FROM agent_settings WHERE user_id IN ($1,$2)`, [A, B])

    // knowledge: same media_id for two tenants does not collide or leak
    await store.upsertKnowledge(A, { mediaId: "17900000000001", title: "A title", caption: "", offer: "A offer", faqs: [] }, true)
    await store.upsertKnowledge(B, { mediaId: "17900000000001", title: "B title", caption: "", offer: "B offer", faqs: [] }, true)
    assert.equal((await store.getKnowledge(A, "17900000000001"))?.title, "A title")
    assert.equal((await store.getKnowledge(B, "17900000000001"))?.title, "B title")
    await store.upsertKnowledge(A, { mediaId: "17900000000001", title: "A2", caption: "", offer: "x", faqs: [{ q: "q'; DROP TABLE contacts;--", a: "a" }] }, true)
    assert.equal((await store.listKnowledge(A)).length, 1)
    assert.equal((await store.getKnowledge(A, "17900000000001"))?.title, "A2")
    assert.equal((await store.getKnowledge(B, "17900000000001"))?.title, "B title")
    await store.setKnowledgeActive(B, "17900000000001", false)
    assert.equal(await store.getKnowledge(B, "17900000000001"), null) // inactive knowledge is not served
    assert.ok(await store.getKnowledge(A, "17900000000001"))
    await store.deleteKnowledge(B, "17900000000001")
    assert.ok(await store.getKnowledge(A, "17900000000001")) // B's delete did not touch A

    // conversations: unique per (user, igsid); CAS lets exactly one of N racing writers win
    await store.startConversation(A, "ig1", "17900000000001", newAgentState())
    await store.startConversation(B, "ig1", "17900000000001", newAgentState())
    const c = await store.getConversation(A, "ig1")
    assert.ok(c)
    const results = await Promise.all(Array.from({ length: 12 }, (_, i) => store.saveConversation(A, "ig1", c!.version, { ...newAgentState(), turn: i + 1 })))
    assert.equal(results.filter(Boolean).length, 1)
    assert.equal((await store.getConversation(B, "ig1"))?.version, 0) // B's row untouched
    assert.equal(await store.saveConversation(B, "ig1", 99, newAgentState()), false) // wrong version
    // restart on a new comment bumps version (an in-flight turn from before cannot overwrite the new conversation)
    const before = (await store.getConversation(A, "ig1"))!
    await store.startConversation(A, "ig1", "17900000000009", newAgentState())
    assert.equal(await store.saveConversation(A, "ig1", before.version, { ...newAgentState(), turn: 5 }), false)

    // dispatch idempotency under a race, and per-tenant keys
    const claims = await Promise.all(Array.from({ length: 10 }, () => store.claimLeadDispatch(A, "ig1", "m1", "whatsapp")))
    assert.equal(claims.filter(Boolean).length, 1)
    assert.equal(await store.claimLeadDispatch(B, "ig1", "m1", "whatsapp"), true)
    assert.equal(await store.claimLeadDispatch(A, "ig1", "m2", "whatsapp"), true)
    assert.equal(await store.claimLeadDispatch(A, "ig1", "m1", "email"), true)

    // contacts / leads: score never decreases, COALESCE keeps phone, other tenant isolated
    await store.applyLead(A, "ig1", { status: "wa_lead", score: 95, mediaId: "m1", phone: "+919876501234", consentAt: new Date().toISOString(), consentText: "line" })
    await store.applyLead(A, "ig1", { status: "handoff", score: 10, mediaId: "m1" })
    const ca = await store.getContact(A, "ig1")
    assert.equal(Number(ca.lead_score), 95)
    assert.equal(ca.phone, "+919876501234")
    assert.equal(await store.getContact(B, "ig1"), null)
    await store.applyLead(B, "ig1", { status: "engaged", score: 30, mediaId: "m1", unverifiedPhone: "+919123456780" })
    assert.equal((await store.getContact(A, "ig1")).unverified_phone, null)
    assert.equal((await store.listLeads(B)).length, 1)
    assert.equal((await store.listLeads(B)).every((l: any) => l.phone == null), true) // unverified number is never listed as the phone
    assert.equal((await store.listLeads(A, "wa_lead'; DROP TABLE contacts;--")).length, 1) // junk status filter is ignored, parameterised
    assert.equal((await store.listLeads(A, "email_lead")).length, 0)

    // hostile ids are plain data
    const evil = "x'); DELETE FROM contacts; --"
    await store.applyLead(A, evil, { status: "new", score: 0, mediaId: evil })
    await store.startConversation(A, evil, evil, newAgentState())
    assert.ok(await store.getConversation(A, evil))
    assert.ok((await store.getContact(A, "ig1")))

    // connector: B cannot see or change A's; key column is never selected
    const idA = await store.saveConnector(A, "https://a.example/api/leads/ingest", "enc-key-A", true, ["lead.whatsapp_captured"])
    const idB = await store.saveConnector(B, "https://b.example/api/leads/ingest", "enc-key-B", true, ["lead.whatsapp_captured"])
    assert.notEqual(idA, idB)
    const conA = await store.getConnector(A)
    assert.ok(!("secret" in conA))
    assert.equal((await store.getConnector(B)).url, "https://b.example/api/leads/ingest")
    await store.saveConnector(B, "https://b2.example/api/leads/ingest", null, true, ["lead.whatsapp_captured"])
    const sec = await q(`SELECT user_id, url, secret FROM webhook_endpoints WHERE user_id IN ($1,$2) ORDER BY user_id`, [A, B])
    assert.equal(sec[0].secret, "enc-key-A")
    assert.equal(sec[1].secret, "enc-key-B") // blank key keeps the stored key
    assert.equal(sec[0].url, "https://a.example/api/leads/ingest")
    await store.removeConnector(B)
    assert.ok(await store.getConnector(A))

    // takeOver and messages are scoped
    await q(`INSERT INTO conversations (user_id, recipient_id, human_handled) VALUES ($1,'ig1',false),($2,'ig1',false)`, [A, B])
    await store.takeOver(A, "ig1")
    const hh = await q(`SELECT user_id, human_handled FROM conversations WHERE user_id IN ($1,$2) AND recipient_id='ig1' ORDER BY user_id`, [A, B])
    assert.deepEqual(hh.map((r: any) => r.human_handled), [true, false])
    assert.equal((await store.getConversation(B, "ig1"))?.status, "active")

    // settings are per tenant
    await store.saveSettings(A, { enabled: true, tone: "casual", handoffRules: "x".repeat(2000) })
    assert.equal((await store.getSettings(B)).enabled, false)
    assert.equal((await store.getSettings(A)).handoffRules.length, 600)
  } finally {
    await q(`DELETE FROM media_knowledge WHERE user_id IN ($1,$2)`, [A, B]).catch(() => {})
    await q(`DELETE FROM agent_conversations WHERE user_id IN ($1,$2)`, [A, B]).catch(() => {})
    await q(`DELETE FROM contacts WHERE user_id IN ($1,$2)`, [A, B]).catch(() => {})
    await q(`DELETE FROM lead_events WHERE user_id IN ($1,$2)`, [A, B]).catch(() => {})
    await q(`DELETE FROM webhook_endpoints WHERE user_id IN ($1,$2)`, [A, B]).catch(() => {})
    await q(`DELETE FROM conversations WHERE user_id IN ($1,$2)`, [A, B]).catch(() => {})
    await q(`DELETE FROM agent_settings WHERE user_id IN ($1,$2)`, [A, B]).catch(() => {})
    await pool.end()
  }
})

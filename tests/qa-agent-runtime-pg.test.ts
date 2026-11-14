// QA (adversarial, needs real Postgres): runs lib/agent/runtime.ts end to end with a fake Instagram sender, a fake model and a
// recording webhook emitter. Proves: no dispatch without consent, one dispatch per person per Reel, paused agent is silent,
// a failed send does not leave a consent line "asked", the Test panel sends and stores nothing.
// Skipped unless QA_PG_HOST is set.
import test from "node:test"
import assert from "node:assert/strict"
import { register } from "node:module"

const host = process.env.QA_PG_HOST
const skip = host ? false : "set QA_PG_HOST to run"

const text = (t: string) => ({ content: [{ type: "text", text: t }], stop_reason: "end_turn", usage: { input_tokens: 10, output_tokens: 5 } })
const tool = (name: string, input: any) => ({ content: [{ type: "tool_use", id: "t1", name, input }], stop_reason: "tool_use", usage: { input_tokens: 10, output_tokens: 5 } })

test("runtime end to end", { skip }, async () => {
  register("./helpers/alias-hooks.mjs", import.meta.url)
  process.env.ANTHROPIC_API_KEY = "test-key"
  delete process.env.AGENT_ENABLED
  const rt: any = await import("../lib/agent/runtime.ts")
  const send: any = await import("./helpers/stub-send.ts")
  const ev: any = await import("./helpers/stub-events.ts")
  const db: any = await import("./helpers/stub-db.ts")
  const quota: any = await import("./helpers/stub-usage.ts")
  const { CONSENT_LINE } = await import("../lib/agent/consent.ts")
  const q = db.rawQuery
  const U = 920001, V = 920002
  const MEDIA = "17900000000777"
  const queue: any[] = []
  const realFetch = globalThis.fetch
  const llmBodies: any[] = []
  globalThis.fetch = (async (_u: any, init: any) => {
    llmBodies.push(JSON.parse(init.body))
    const r = queue.length ? queue.shift() : text("Happy to help.")
    return { ok: true, status: 200, json: async () => r }
  }) as any
  const user = { id: U, username: "glow", access_token: "tok", business_account_id: "biz", ai_context: null }
  const clean = async () => {
    await q(`DELETE FROM messages WHERE user_id IN ($1,$2)`, [U, V])
    for (const t of ["media_knowledge", "agent_conversations", "contacts", "lead_events", "agent_settings", "conversations"]) await q(`DELETE FROM ${t} WHERE user_id IN ($1,$2)`, [U, V])
  }
  try {
    await clean()
    const store = rt.agentStore()
    await store.upsertKnowledge(U, { mediaId: MEDIA, title: "Hair PRP", caption: "", offer: "20% off", faqs: [] }, true)
    await store.saveSettings(U, { enabled: true })
    await q(`INSERT INTO conversations (user_id, recipient_id) VALUES ($1,'ig-a')`, [U])
    const [{ id: convId }] = await q(`SELECT id FROM conversations WHERE user_id=$1 AND recipient_id='ig-a'`, [U])
    const conv = { id: convId }

    // intro does not send or store anything by itself
    const intro = await rt.prepareAgentIntro(user, MEDIA)
    assert.equal(intro.ok, true)
    assert.equal(send.sent.length, 0)
    await rt.commitAgentStart(user, "ig-a", MEDIA)
    assert.equal((await store.getConversation(U, "ig-a")).status, "active")

    // turn 1 (no consent line yet), turn 2 gives a number BEFORE consent: held, nothing emitted
    await q(`INSERT INTO messages (id, conversation_id, user_id, sender_id, content, is_from_instagram) VALUES ('m1',$1,$2,'ig-a','price?',TRUE)`, [convId, U])
    queue.push(text("It is 20% off."))
    let out = await rt.handleAgentDm(user, conv, "ig-a", "price?")
    assert.equal(out.status, "sent")
    assert.ok(!send.sent.at(-1).content.message.includes(CONSENT_LINE))
    await q(`INSERT INTO messages (id, conversation_id, user_id, sender_id, content, is_from_instagram) VALUES ('m2',$1,$2,'ig-a','my number 9876501234',TRUE)`, [convId, U])
    queue.push(tool("capture_phone", { raw: "9876501234" }), text("Thanks."))
    out = await rt.handleAgentDm(user, conv, "ig-a", "my number 9876501234")
    assert.ok(send.sent.at(-1).content.message.endsWith(CONSENT_LINE))
    assert.equal(ev.emitted.length, 0, "no dispatch before consent")
    let c = await store.getContact(U, "ig-a")
    assert.equal(c.phone, null)
    assert.equal(c.unverified_phone, "+919876501234")

    // "yes": the held number is released once, with consent proof, and exactly one lead event is emitted
    await q(`INSERT INTO messages (id, conversation_id, user_id, sender_id, content, is_from_instagram) VALUES ('m3',$1,$2,'ig-a','yes',TRUE)`, [convId, U])
    queue.push(text("Great, the team will message you."))
    out = await rt.handleAgentDm(user, conv, "ig-a", "yes")
    assert.equal(ev.emitted.length, 1)
    const e = ev.emitted[0]
    assert.equal(e.event, "lead.whatsapp_captured")
    assert.equal(e.data.phone, "+919876501234")
    assert.equal(e.data.consent_given, true)
    assert.equal(e.data.consent_text, CONSENT_LINE)
    assert.ok(!JSON.stringify(e.data).includes("ig-a"))
    c = await store.getContact(U, "ig-a")
    assert.equal(c.phone, "+919876501234")
    assert.equal(c.lead_status, "wa_lead")
    // replay of "yes" / another number later: still one dispatch for this person+Reel
    queue.push(tool("capture_phone", { raw: "9123456780" }), text("ok"))
    await rt.handleAgentDm(user, conv, "ig-a", "also 9123456780")
    assert.equal(ev.emitted.length, 1)

    // tenant V with the same igsid is untouched
    assert.equal(await store.getConversation(V, "ig-a"), null)
    assert.equal(await store.getContact(V, "ig-a"), null)

    // owner pauses the agent: live chats stop being answered by the agent
    await rt.commitAgentStart(user, "ig-a", MEDIA)
    await store.saveSettings(U, { enabled: false })
    const sentBefore = send.sent.length
    const callsBefore = llmBodies.length
    out = await rt.handleAgentDm(user, conv, "ig-a", "hello?")
    assert.equal(out.handled, false)
    assert.equal(send.sent.length, sentBefore)
    assert.equal(llmBodies.length, callsBefore)
    await store.saveSettings(U, { enabled: true })

    // knowledge deleted and no business context: the agent steps aside
    await store.deleteKnowledge(U, MEDIA)
    out = await rt.handleAgentDm(user, conv, "ig-a", "hello?")
    assert.equal(out.handled, false)
    await store.upsertKnowledge(U, { mediaId: MEDIA, title: "Hair PRP", caption: "", offer: "20% off", faqs: [] }, true)

    // a failed send must not leave the consent line recorded as shown
    await rt.commitAgentStart(user, "ig-b", MEDIA)
    await q(`INSERT INTO conversations (user_id, recipient_id) VALUES ($1,'ig-b')`, [U])
    const [{ id: convB }] = await q(`SELECT id FROM conversations WHERE user_id=$1 AND recipient_id='ig-b'`, [U])
    // advance to turn 1 so the next reply would carry the consent line
    await store.saveConversation(U, "ig-b", 0, { ...(await store.getConversation(U, "ig-b")).state, turn: 1 })
    send.control.ok = false
    queue.push(text("It is 20% off."))
    out = await rt.handleAgentDm(user, { id: convB }, "ig-b", "how much?")
    send.control.ok = true
    assert.equal(out.status, "failed")
    assert.equal((await store.getConversation(U, "ig-b")).state.consent.status, "none")

    // concurrent DMs for the same person: only one is answered
    await rt.commitAgentStart(user, "ig-c", MEDIA)
    await q(`INSERT INTO conversations (user_id, recipient_id) VALUES ($1,'ig-c')`, [U])
    const sentN = send.sent.length
    for (let i = 0; i < 8; i++) queue.push(text("hi"))
    const outs = await Promise.all(Array.from({ length: 8 }, () => rt.handleAgentDm(user, null, "ig-c", "hello")))
    assert.equal(send.sent.length - sentN, 1)
    assert.equal(outs.filter((o: any) => o.status === "sent").length, 1)

    // quota exhausted: nothing is sent, nothing crashes
    quota.quota.allowed = false
    const s2 = send.sent.length
    out = await rt.handleAgentDm(user, conv, "ig-a", "hello")
    quota.quota.allowed = true
    assert.equal(send.sent.length, s2)

    // Test panel: no Instagram message, no contact, no lead event
    const before = { sent: send.sent.length, emitted: ev.emitted.length, contacts: (await q(`SELECT count(*)::int n FROM contacts WHERE user_id=$1`, [U]))[0].n, convs: (await q(`SELECT count(*)::int n FROM agent_conversations WHERE user_id=$1`, [U]))[0].n }
    queue.push(tool("capture_phone", { raw: "9876501299" }), text("Noted."))
    const sim = await rt.runSimulation(user, MEDIA, { ...(await import("../lib/agent/engine.ts")).newAgentState(), turn: 1, consent: { status: "granted", askedAt: "x", grantedAt: new Date().toISOString(), text: CONSENT_LINE, via: "reply" } }, [], "9876501299")
    assert.equal(sim.ok, true)
    assert.equal(sim.turn.effects[0].consented, true) // would have been consented...
    assert.equal(send.sent.length, before.sent)       // ...but nothing is sent,
    assert.equal(ev.emitted.length, before.emitted)   // dispatched,
    assert.equal((await q(`SELECT count(*)::int n FROM contacts WHERE user_id=$1`, [U]))[0].n, before.contacts) // or stored
    assert.equal((await q(`SELECT count(*)::int n FROM agent_conversations WHERE user_id=$1`, [U]))[0].n, before.convs)
  } finally {
    globalThis.fetch = realFetch
    await clean().catch(() => {})
    await db.closePool()
  }
})

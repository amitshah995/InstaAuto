// Regression test: the optional `conversations` join (no migration in this repo) must never break Overview/Leads.
// Who runs it: `npm test`. Uses a fake query function, no database.
import { test } from "node:test"
import assert from "node:assert/strict"
import { createAgentStore } from "../lib/agent/store.ts"

function fakeQ(failJoin: boolean) {
  const seen: string[] = []
  const q = async (text: string, _v?: any[]) => {
    seen.push(text)
    if (failJoin && /JOIN conversations/i.test(text)) throw new Error('column c.recipient_username does not exist')
    return [{ igsid: "1", media_id: "99999", status: "active", turn_count: 1 }]
  }
  return { q: q as any, seen }
}

test("listConversations falls back to a plain scoped query when the join fails", async () => {
  const f = fakeQ(true)
  const rows = await createAgentStore(f.q).listConversations(7, 50)
  assert.equal(rows.length, 1)
  assert.equal(f.seen.length, 2)
  assert.ok(!/JOIN/i.test(f.seen[1]))
  assert.match(f.seen[1], /user_id = \$1/) // tenant scoping is kept in the fallback
})

test("listLeads falls back to a plain scoped query when the join fails", async () => {
  const f = fakeQ(true)
  await createAgentStore(f.q).listLeads(7, undefined, 50)
  assert.equal(f.seen.length, 2)
  assert.ok(!/JOIN/i.test(f.seen[1]))
  assert.match(f.seen[1], /user_id = \$1/)
})

test("no fallback is used when the join works", async () => {
  const f = fakeQ(false)
  await createAgentStore(f.q).listConversations(7, 50)
  assert.equal(f.seen.length, 1)
})

test("a failing plain query still throws (real errors are not hidden)", async () => {
  const q = (async () => { throw new Error("boom") }) as any
  await assert.rejects(() => createAgentStore(q).listLeads(7))
})

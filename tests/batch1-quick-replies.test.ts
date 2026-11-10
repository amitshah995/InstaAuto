// Unit tests for quick replies: limits, API body, tapped-chip lookup, flow engine integration (pure, no network).
import test from "node:test"
import assert from "node:assert/strict"
import {
  QUICK_REPLY_MAX_COUNT,
  QUICK_REPLY_TITLE_MAX,
  buildQuickRepliesApi,
  findQuickReplyRule,
  findQuickReplyTarget,
  sanitizeQuickReplies,
} from "../lib/messaging/quick-replies.ts"
import { advance, simulate } from "../lib/flows/engine.ts"
import { sanitizeResponseContent } from "../lib/automations/sanitize.ts"

test("sanitizeQuickReplies enforces Meta limits: 13 chips, 20-char titles, unique titles, payload present", () => {
  const input = Array.from({ length: 30 }, (_, i) => ({ title: `Option number ${i} is very long indeed` }))
  const out = sanitizeQuickReplies(input)
  assert.equal(out.length, QUICK_REPLY_MAX_COUNT)
  for (const q of out) {
    assert.ok(Array.from(q.title).length <= QUICK_REPLY_TITLE_MAX)
    assert.ok(q.payload.length > 0)
  }
  const dup = sanitizeQuickReplies([{ title: "Price" }, { title: " price " }, { title: "" }, null, { title: "Book" }])
  assert.deepEqual(dup.map((q) => q.title), ["Price", "Book"])
  assert.deepEqual(sanitizeQuickReplies("nope"), [])
})

test("titles are cut by characters, not UTF-16 units", () => {
  const out = sanitizeQuickReplies([{ title: "🔥".repeat(30) }])
  assert.equal(Array.from(out[0].title).length, QUICK_REPLY_TITLE_MAX)
})

test("buildQuickRepliesApi returns text chips exactly as the Send API expects", () => {
  const api = buildQuickRepliesApi([{ title: "Price", payload: "QR_price", reply: "It is Rs 499" }])
  assert.deepEqual(api, [{ content_type: "text", title: "Price", payload: "QR_price" }]) // reply is internal, never sent
  assert.deepEqual(buildQuickRepliesApi(undefined), [])
})

test("duplicate payloads are made unique", () => {
  const out = sanitizeQuickReplies([{ title: "A", payload: "same" }, { title: "B", payload: "same" }])
  assert.notEqual(out[0].payload, out[1].payload)
})

test("findQuickReplyTarget finds chips on the message, sequence steps and flow nodes; needs a reply", () => {
  const autos = [
    { id: "a1", response_content: { message: "hi", quick_replies: [{ title: "Price", payload: "P1", reply: "Rs 499" }] } },
    { id: "a2", response_content: { steps: [{ text: "x", quick_replies: [{ title: "Book", payload: "B1", reply: "Book here" }] }] } },
    { id: "a3", response_content: { flow: { startNodeId: "m", nodes: { m: { type: "message", text: "q", quick_replies: [{ title: "Yes", payload: "Y1", reply: "Great" }, { title: "No", payload: "N1" }] } } } } },
  ]
  assert.equal(findQuickReplyTarget(autos, "P1")?.reply, "Rs 499")
  assert.equal(findQuickReplyTarget(autos, "B1")?.automation.id, "a2")
  assert.equal(findQuickReplyTarget(autos, "Y1")?.title, "Yes")
  assert.equal(findQuickReplyTarget(autos, "N1"), null) // no reply: falls back to keyword/flow handling
  assert.equal(findQuickReplyTarget(autos, "nope"), null)
  assert.equal(findQuickReplyTarget(autos, ""), null)
})

test("findQuickReplyRule matches quick_reply and postback rules by payload, case-insensitively", () => {
  const rules = [
    { id: "r1", trigger_type: "keyword", trigger_value: "qr_x" },
    { id: "r2", trigger_type: "quick_reply", trigger_value: "qr_x" },
  ]
  assert.equal(findQuickReplyRule(rules, "QR_X")?.id, "r2")
  assert.equal(findQuickReplyRule(rules, "other"), null)
})

test("flow engine carries chips on message actions and the simulator offers them as suggestions", () => {
  const flow = {
    startNodeId: "m1",
    nodes: {
      m1: { type: "message", text: "Pick one", quick_replies: [{ title: "Price", payload: "p" }, { title: "Book", payload: "b" }], next: "c" },
      c: { type: "condition", branches: [{ keyword: "price", next: "m2" }], default_next: null },
      m2: { type: "message", text: "Rs 499", next: null },
    },
  }
  const r = advance(flow, "m1", null)
  const first = r.actions[0]
  assert.equal(first.kind, "message")
  assert.deepEqual(first.kind === "message" && first.quickReplies.map((q) => q.title), ["Price", "Book"])
  const sim = simulate(flow, [])
  assert.deepEqual(sim.quickReplies, ["Price", "Book"])
  const tapped = simulate(flow, ["Price"]) // a tapped chip arrives as its title
  assert.ok(tapped.lines.some((l) => l.text === "Rs 499"))
  assert.deepEqual(tapped.quickReplies, [])
})

test("sanitizeResponseContent clamps chips on message, steps and flow nodes", () => {
  const many = Array.from({ length: 20 }, (_, i) => ({ title: `T${i}` }))
  const out = sanitizeResponseContent({
    message: "m",
    quick_replies: many,
    steps: [{ text: "s", quick_replies: many }, { text: "plain" }],
    flow: { startNodeId: "a", nodes: { a: { type: "message", text: "x", quick_replies: many }, b: { type: "tag", tag: "t" } } },
  })
  assert.equal(out.quick_replies.length, 13)
  assert.equal(out.steps[0].quick_replies.length, 13)
  assert.equal("quick_replies" in out.steps[1], false)
  assert.equal(out.flow.nodes.a.quick_replies.length, 13)
  assert.equal("quick_replies" in out.flow.nodes.b, false)
})

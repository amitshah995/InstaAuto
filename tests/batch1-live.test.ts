// Unit tests for the live comment trigger helpers (pure, no network).
import test from "node:test"
import assert from "node:assert/strict"
import {
  LIVE_MAX_EVENT_AGE_MS,
  isStaleLiveEvent,
  normalizeEntryChanges,
  pickLiveAutomation,
  readCommentValue,
} from "../lib/automations/comment-events.ts"

test("normalizeEntryChanges accepts the changes[] layout and the flat entry.field layout", () => {
  const a = normalizeEntryChanges({ id: "1", changes: [{ field: "live_comments", value: { id: "c1" } }, { nope: true }] })
  assert.deepEqual(a, [{ field: "live_comments", value: { id: "c1" } }])
  const b = normalizeEntryChanges({ id: "1", field: "live_comments", value: { id: "c2" } })
  assert.deepEqual(b, [{ field: "live_comments", value: { id: "c2" } }])
  assert.deepEqual(normalizeEntryChanges({ id: "1", messaging: [] }), [])
  assert.deepEqual(normalizeEntryChanges(null), [])
})

test("readCommentValue reads Business Login (id) and Facebook Login (comment_id) payloads", () => {
  const base = { from: { id: "u1", username: "ann" }, text: "link please", media: { id: "m1", media_product_type: "LIVE" } }
  assert.deepEqual(readCommentValue({ ...base, id: "c1" }), {
    commentId: "c1", text: "link please", senderId: "u1", username: "ann", mediaId: "m1", mediaProductType: "LIVE",
  })
  assert.equal(readCommentValue({ ...base, comment_id: "c9" })?.commentId, "c9")
})

test("readCommentValue rejects payloads missing an essential field", () => {
  assert.equal(readCommentValue(null), null)
  assert.equal(readCommentValue({ id: "c", text: "x", media: { id: "m" } }), null) // no sender
  assert.equal(readCommentValue({ id: "c", from: { id: "u" }, media: { id: "m" } }), null) // no text
  assert.equal(readCommentValue({ id: "c", from: { id: "u" }, text: "x" }), null) // no media
})

test("isStaleLiveEvent: only events older than the broadcast ceiling are stale", () => {
  const now = 1_800_000_000_000
  assert.equal(isStaleLiveEvent(now / 1000 - 60, now), false)
  assert.equal(isStaleLiveEvent((now - LIVE_MAX_EVENT_AGE_MS - 1000) / 1000, now), true)
  assert.equal(isStaleLiveEvent(undefined, now), false) // no timestamp: do not drop
  assert.equal(isStaleLiveEvent("garbage", now), false)
})

test("pickLiveAutomation: only live rules, keyword beats catch-all, no match returns null", () => {
  const rules = [
    { id: "dm", trigger_source: "dm", trigger_type: "keyword", trigger_value: "link" },
    { id: "comment", trigger_source: "comment", trigger_type: "keyword", trigger_value: "link" },
    { id: "all", trigger_source: "live", trigger_type: "reply_all", trigger_value: "ALL_COMMENTS" },
    { id: "kw", trigger_source: "live", trigger_type: "keyword", trigger_value: "link, price" },
  ]
  assert.equal(pickLiveAutomation(rules, "send me the LINK!")?.id, "kw")
  assert.equal(pickLiveAutomation(rules, "hello")?.id, "all")
  assert.equal(pickLiveAutomation(rules.slice(0, 2), "link"), null)
  assert.equal(pickLiveAutomation([rules[3]], "hello"), null)
})

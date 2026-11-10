// Unit tests for comment scope: specific / all / next post (pure, plus the pin compare-and-set with a fake client).
import test from "node:test"
import assert from "node:assert/strict"
import {
  fetchMediaMeta,
  isEligibleNextMedia,
  isNextPostPending,
  needsMediaTimestamp,
  parseIgTimestamp,
  pickCommentAutomation,
  pinNextPostRule,
  ruleScope,
} from "../lib/automations/comment-scope.ts"
import { sanitizeResponseContent } from "../lib/automations/sanitize.ts"

const T0 = Date.parse("2026-11-10T10:00:00Z")
const rule = (o: any) => ({ id: "r", trigger_type: "keyword", trigger_value: "link", specific_media_id: null, created_at: new Date(T0).toISOString(), response_content: {}, ...o })
const next = (o: any = {}) => rule({ response_content: { comment_scope: "next" }, ...o })

test("parseIgTimestamp understands Instagram's +0000 offset and ISO Z", () => {
  assert.equal(parseIgTimestamp("2026-11-10T10:00:00+0000"), T0)
  assert.equal(parseIgTimestamp("2026-11-10T15:30:00+0530"), T0)
  assert.equal(parseIgTimestamp("2026-11-10T10:00:00Z"), T0)
  assert.equal(parseIgTimestamp("garbage"), null)
  assert.equal(parseIgTimestamp(undefined), null)
})

test("ruleScope: all / specific / next (a pinned next-rule reads as specific)", () => {
  assert.equal(ruleScope(rule({})), "all")
  assert.equal(ruleScope(rule({ specific_media_id: "m1" })), "specific")
  assert.equal(ruleScope(next()), "next")
  assert.equal(ruleScope(next({ specific_media_id: "m9" })), "specific")
  assert.equal(isNextPostPending(next()), true)
  assert.equal(isNextPostPending(next({ specific_media_id: "m9" })), false)
})

test("isEligibleNextMedia: published after rule creation yes, before no, unknown time no, story/ad/live no", () => {
  const r = next()
  assert.equal(isEligibleNextMedia(r, T0 + 60_000, "FEED"), true)
  assert.equal(isEligibleNextMedia(r, T0, "REELS"), true) // same second counts
  assert.equal(isEligibleNextMedia(r, T0 - 1, "FEED"), false)
  assert.equal(isEligibleNextMedia(r, null, "FEED"), false)
  assert.equal(isEligibleNextMedia(r, T0 + 1000, "STORY"), false)
  assert.equal(isEligibleNextMedia(r, T0 + 1000, "ad"), false)
  assert.equal(isEligibleNextMedia(r, T0 + 1000, null), true)
  assert.equal(isEligibleNextMedia(rule({ created_at: null, response_content: { comment_scope: "next" } }), T0, "FEED"), false)
})

test("pickCommentAutomation: old behaviour is unchanged for specific and global rules", () => {
  const rules = [
    rule({ id: "global", trigger_value: "link" }),
    rule({ id: "post", specific_media_id: "m1", trigger_value: "link" }),
    rule({ id: "ra", specific_media_id: "m2", trigger_type: "reply_all", trigger_value: "ALL_COMMENTS" }),
  ]
  const ctx = (mediaId: string, text: string) => ({ mediaId, text, mediaPublishedMs: null })
  assert.equal(pickCommentAutomation(rules, ctx("m2", "anything")).match?.id, "ra")
  assert.equal(pickCommentAutomation(rules, ctx("m1", "send link")).match?.id, "post")
  assert.equal(pickCommentAutomation(rules, ctx("m3", "send link")).match?.id, "global")
  assert.equal(pickCommentAutomation(rules, ctx("m3", "hello")).match, null)
  assert.equal(pickCommentAutomation(rules, ctx("m3", "send link")).pin, false)
})

test("pending next-post rule is NOT treated as an all-posts rule", () => {
  const rules = [next({ id: "n" })]
  const old = pickCommentAutomation(rules, { mediaId: "old", text: "link", mediaPublishedMs: T0 - 86_400_000, mediaProductType: "FEED" })
  assert.equal(old.match, null) // comment on an older post never fires or binds it
  const unknownTime = pickCommentAutomation(rules, { mediaId: "x", text: "link", mediaPublishedMs: null })
  assert.equal(unknownTime.match, null) // cannot verify -> do not fire
})

test("pending next-post rule matches the first eligible post and asks to be pinned", () => {
  const rules = [next({ id: "n" })]
  const hit = pickCommentAutomation(rules, { mediaId: "new", text: "send me the LINK", mediaPublishedMs: T0 + 5_000, mediaProductType: "REELS" })
  assert.equal(hit.match?.id, "n")
  assert.equal(hit.pin, true)
  const miss = pickCommentAutomation(rules, { mediaId: "new", text: "nice video", mediaPublishedMs: T0 + 5_000 })
  assert.equal(miss.match, null)
})

test("reply-all next-post rule matches any comment on the new post", () => {
  const rules = [next({ id: "n", trigger_type: "reply_all", trigger_value: "ALL_COMMENTS" })]
  const hit = pickCommentAutomation(rules, { mediaId: "new", text: "wow", mediaPublishedMs: T0 + 1 })
  assert.equal(hit.match?.id, "n")
  assert.equal(hit.pin, true)
})

test("once pinned, the rule only answers its own post and no longer pins", () => {
  const rules = [next({ id: "n", specific_media_id: "new" })]
  assert.equal(pickCommentAutomation(rules, { mediaId: "new", text: "link", mediaPublishedMs: null }).match?.id, "n")
  assert.equal(pickCommentAutomation(rules, { mediaId: "new", text: "link", mediaPublishedMs: null }).pin, false)
  assert.equal(pickCommentAutomation(rules, { mediaId: "later", text: "link", mediaPublishedMs: T0 + 9e6 }).match, null)
})

test("a next-post rule beats an all-posts rule with the same keyword on the new post", () => {
  const rules = [rule({ id: "global" }), next({ id: "n" })]
  const hit = pickCommentAutomation(rules, { mediaId: "new", text: "link", mediaPublishedMs: T0 + 1 })
  assert.equal(hit.match?.id, "n")
  const older = pickCommentAutomation(rules, { mediaId: "older", text: "link", mediaPublishedMs: T0 - 1 })
  assert.equal(older.match?.id, "global")
})

test("needsMediaTimestamp only when a pending next rule matches the text", () => {
  const rules = [rule({ id: "g" }), next({ id: "n", trigger_value: "reel" })]
  assert.equal(needsMediaTimestamp(rules, "link"), false)
  assert.equal(needsMediaTimestamp(rules, "the reel please"), true)
  assert.equal(needsMediaTimestamp([next({ trigger_type: "reply_all" })], "x"), true)
  assert.equal(needsMediaTimestamp([], "x"), false)
})

// --- pin compare-and-set with a fake Supabase-like client ---
function fakeClient(row: { specific_media_id: string | null }, opts: { failUpdate?: boolean } = {}) {
  return {
    from() {
      const state: any = {}
      const chain: any = {
        update(v: any) { state.update = v; return chain },
        select() { return chain },
        eq() { return chain },
        is() { return chain },
        single() { return Promise.resolve({ data: { specific_media_id: row.specific_media_id } }) },
        then(resolve: any) {
          if (opts.failUpdate) return resolve({ data: null, error: { message: "boom" } })
          if (state.update && row.specific_media_id === null) { row.specific_media_id = state.update.specific_media_id; return resolve({ data: [{ id: "r" }], error: null }) }
          return resolve({ data: [], error: null })
        },
      }
      return chain
    },
  }
}

test("pinNextPostRule: first comment pins; parallel comment on same post still true; other post false", async () => {
  const row = { specific_media_id: null as string | null }
  const c = fakeClient(row)
  assert.equal(await pinNextPostRule(c, "r", "new"), true)
  assert.equal(row.specific_media_id, "new")
  assert.equal(await pinNextPostRule(c, "r", "new"), true) // lost the race to the same media
  assert.equal(await pinNextPostRule(c, "r", "another"), false) // bound elsewhere
})

test("pinNextPostRule returns false when the database call fails", async () => {
  assert.equal(await pinNextPostRule(fakeClient({ specific_media_id: null }, { failUpdate: true }), "r", "new"), false)
  assert.equal(await pinNextPostRule({ from() { throw new Error("down") } }, "r", "new"), false)
})

test("fetchMediaMeta parses the Graph response and fails safe", async () => {
  const ok = await fetchMediaMeta("tok", "m1", (async () => ({ json: async () => ({ timestamp: "2026-11-10T10:00:05+0000", media_product_type: "REELS" }) })) as any)
  assert.deepEqual(ok, { publishedMs: T0 + 5000, productType: "REELS" })
  const err = await fetchMediaMeta("tok", "m1", (async () => ({ json: async () => ({ error: { code: 190 } }) })) as any)
  assert.deepEqual(err, { publishedMs: null, productType: null })
  const down = await fetchMediaMeta("tok", "m1", (async () => { throw new Error("net") }) as any)
  assert.deepEqual(down, { publishedMs: null, productType: null })
})

test("sanitizeResponseContent keeps only valid comment_scope values", () => {
  assert.equal(sanitizeResponseContent({ message: "x", comment_scope: "next" }).comment_scope, "next")
  assert.equal("comment_scope" in sanitizeResponseContent({ message: "x", comment_scope: "evil" }), false)
})

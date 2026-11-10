// Unit tests for flow conditions, set-variable / remove-tag nodes, interpolation and the simulator (pure, no network).
import test from "node:test"
import assert from "node:assert/strict"
import {
  MAX_RULES_PER_CONDITION,
  branchRules,
  evaluateBranch,
  evaluateRule,
  flowNeedsContactFacts,
  flowUsesFollowRule,
  flowUsesRuleKind,
  interpolateVariables,
  minutesInZone,
  normalizeVarName,
  sanitizeRules,
  tagKey,
  timeInRange,
} from "../lib/flows/conditions.ts"
import { advance, pickBranch, simulate } from "../lib/flows/engine.ts"
import { applyVariable, contactToVariables } from "../lib/contacts/variables.ts"
import { sanitizeResponseContent } from "../lib/automations/sanitize.ts"

// 2026-11-10 10:00 UTC = 15:30 in Asia/Kolkata (UTC+5:30)
const NOON_UTC = new Date("2026-11-10T10:00:00Z")

test("minutesInZone / timeInRange: Asia/Kolkata default, midnight wrap, bad zone falls back", () => {
  assert.equal(minutesInZone(NOON_UTC, "Asia/Kolkata"), 15 * 60 + 30)
  assert.equal(minutesInZone(NOON_UTC, "UTC"), 10 * 60)
  assert.equal(minutesInZone(NOON_UTC, "Not/AZone"), 15 * 60 + 30)
  assert.equal(timeInRange(15 * 60 + 30, "09:00", "18:00"), true)
  assert.equal(timeInRange(18 * 60, "09:00", "18:00"), false) // end is exclusive
  assert.equal(timeInRange(23 * 60, "22:00", "06:00"), true) // wraps midnight
  assert.equal(timeInRange(3 * 60, "22:00", "06:00"), true)
  assert.equal(timeInRange(12 * 60, "22:00", "06:00"), false)
  assert.equal(timeInRange(5, "00:00", "00:00"), true) // same = all day
  assert.equal(timeInRange(5, "25:00", "06:00"), false) // invalid
})

test("variable rules: equals, contains, is_set, numeric compare, case-insensitive names", () => {
  const ctx = { variables: { Budget: "7500", city: "Pune ", note: "wants the GOLD plan" } }
  assert.equal(evaluateRule({ kind: "variable", name: "budget", op: "gt", value: "5000" }, ctx), true)
  assert.equal(evaluateRule({ kind: "variable", name: "budget", op: "lt", value: "5000" }, ctx), false)
  assert.equal(evaluateRule({ kind: "variable", name: "city", op: "equals", value: "pune" }, ctx), true)
  assert.equal(evaluateRule({ kind: "variable", name: "city", op: "not_equals", value: "delhi" }, ctx), true)
  assert.equal(evaluateRule({ kind: "variable", name: "note", op: "contains", value: "gold" }, ctx), true)
  assert.equal(evaluateRule({ kind: "variable", name: "email", op: "is_set" }, ctx), false)
  assert.equal(evaluateRule({ kind: "variable", name: "email", op: "not_set" }, ctx), true)
  assert.equal(evaluateRule({ kind: "variable", name: "city", op: "gt", value: "5" }, ctx), false) // not numeric
  assert.equal(evaluateRule({ kind: "variable", name: "last_reply", op: "equals", value: "yes" }, { text: "YES" }), true)
})

test("tag rules compare cleaned tags (Warm Lead == warm-lead)", () => {
  assert.equal(tagKey("Warm Lead"), "warm-lead")
  const ctx = { tags: ["warm-lead", "vip"] }
  assert.equal(evaluateRule({ kind: "tag", tag: "Warm Lead", op: "has" }, ctx), true)
  assert.equal(evaluateRule({ kind: "tag", tag: "cold", op: "has" }, ctx), false)
  assert.equal(evaluateRule({ kind: "tag", tag: "cold", op: "not_has" }, ctx), true)
  assert.equal(evaluateRule({ kind: "tag", tag: "", op: "not_has" }, ctx), true)
  assert.equal(evaluateRule({ kind: "tag", tag: "", op: "has" }, ctx), false)
})

test("follows rule: unknown is false for BOTH is and is_not", () => {
  assert.equal(evaluateRule({ kind: "follows", op: "is" }, { follows: "following" }), true)
  assert.equal(evaluateRule({ kind: "follows", op: "is_not" }, { follows: "following" }), false)
  assert.equal(evaluateRule({ kind: "follows", op: "is_not" }, { follows: "not_following" }), true)
  assert.equal(evaluateRule({ kind: "follows", op: "is" }, { follows: "unknown" }), false)
  assert.equal(evaluateRule({ kind: "follows", op: "is_not" }, { follows: "unknown" }), false)
  assert.equal(evaluateRule({ kind: "follows", op: "is" }, {}), false)
})

test("in_window rule and time rule use the context (Asia/Kolkata by default)", () => {
  assert.equal(evaluateRule({ kind: "in_window", op: "is" }, {}), true) // default inside
  assert.equal(evaluateRule({ kind: "in_window", op: "is" }, { inWindow: false }), false)
  assert.equal(evaluateRule({ kind: "in_window", op: "is_not" }, { inWindow: false }), true)
  const open = { kind: "time", from: "09:00", to: "18:00", op: "between" } as const
  assert.equal(evaluateRule(open, { now: NOON_UTC }), true) // 15:30 IST
  assert.equal(evaluateRule(open, { now: NOON_UTC, timezone: "UTC" }), true) // 10:00 UTC
  assert.equal(evaluateRule(open, { now: new Date("2026-11-10T16:00:00Z") }), false) // 21:30 IST
  assert.equal(evaluateRule({ ...open, op: "not_between" }, { now: new Date("2026-11-10T16:00:00Z") }), true)
})

test("text rules: contains, not_contains, equals, keyword (comma list), phrase", () => {
  const t = (op: any, value: string, text: string) => evaluateRule({ kind: "text", op, value }, { text })
  assert.equal(t("contains", "pric", "What is the PRICE?"), true) // substring
  assert.equal(t("not_contains", "refund", "What is the price"), true)
  assert.equal(t("equals", "yes", " Yes! "), true)
  assert.equal(t("equals", "yes", "yes please"), false)
  assert.equal(t("keyword", "price, cost", "the cost please"), true)
  assert.equal(t("keyword", "pric", "price"), false) // whole words only
  assert.equal(t("phrase", "free guide", "get the free guide now"), true)
  assert.equal(t("contains", "", "anything"), false)
  assert.equal(t("contains", "कीमत", "इसकी कीमत क्या है"), true)
})

test("quick_reply rule matches the tapped payload only", () => {
  assert.equal(evaluateRule({ kind: "quick_reply", payload: "P1" }, { quickReplyPayload: "P1" }), true)
  assert.equal(evaluateRule({ kind: "quick_reply", payload: "P1" }, { quickReplyPayload: "P2" }), false)
  assert.equal(evaluateRule({ kind: "quick_reply", payload: "P1" }, {}), false)
})

test("sanitizeRules: max 5, drops invalid, fixes names, bad times and ops", () => {
  const many = Array.from({ length: 9 }, (_, i) => ({ kind: "tag", tag: `t${i}`, op: "has" }))
  assert.equal(sanitizeRules(many).length, MAX_RULES_PER_CONDITION)
  const out = sanitizeRules([
    { kind: "variable", name: "Budget Amount!", op: "gt", value: "5" },
    { kind: "variable", name: "x", op: "drop_table" },
    { kind: "time", from: "9am", to: "18:00" },
    { kind: "text", op: "contains", value: "  " },
    { kind: "nope" },
    null,
    { kind: "time", from: "09:00", to: "18:00", op: "not_between" },
  ])
  assert.deepEqual(out, [
    { kind: "variable", name: "budget_amount", op: "gt", value: "5" },
    { kind: "time", from: "09:00", to: "18:00", op: "not_between" },
  ])
  assert.deepEqual(sanitizeRules("x"), [])
  assert.equal(normalizeVarName("  City Name "), "city_name")
})

test("evaluateBranch: AND by default, OR with match any, empty branch never fires", () => {
  const rules = [{ kind: "tag", tag: "vip", op: "has" }, { kind: "variable", name: "city", op: "equals", value: "pune" }]
  assert.equal(evaluateBranch({ rules }, { tags: ["vip"], variables: { city: "Pune" } }), true)
  assert.equal(evaluateBranch({ rules }, { tags: ["vip"], variables: { city: "Delhi" } }), false)
  assert.equal(evaluateBranch({ rules, match: "any" }, { tags: ["vip"], variables: { city: "Delhi" } }), true)
  assert.equal(evaluateBranch({ rules, match: "any" }, {}), false)
  assert.equal(evaluateBranch({}, { text: "hi" }), false)
  assert.equal(evaluateBranch({ keyword: "" }, { text: "hi" }), false)
})

test("legacy keyword is the first rule and keeps whole-phrase semantics; total capped at 5", () => {
  const six = Array.from({ length: 6 }, (_, i) => ({ kind: "tag", tag: `t${i}`, op: "has" }))
  assert.equal(branchRules({ keyword: "yes", rules: six }).length, 5)
  assert.equal(evaluateBranch({ keyword: "yes, please" }, { text: "yes" }), false) // old behaviour: the whole string is one phrase
  assert.equal(evaluateBranch({ keyword: "yes, please" }, { text: "oh yes please do" }), true)
  assert.equal(evaluateBranch({ keyword: "yes", rules: [{ kind: "tag", tag: "vip", op: "has" }] }, { text: "yes", tags: ["vip"] }), true)
  assert.equal(evaluateBranch({ keyword: "yes", rules: [{ kind: "tag", tag: "vip", op: "has" }] }, { text: "yes", tags: [] }), false)
})

test("interpolateVariables: values, fallback, last_reply, unknown", () => {
  const ctx = { variables: { name: "Priya" }, text: "gold" }
  assert.equal(interpolateVariables("Hi {{name}}!", ctx), "Hi Priya!")
  assert.equal(interpolateVariables("Hi {{ NAME }}!", ctx), "Hi Priya!")
  assert.equal(interpolateVariables("Hi {{city|there}}!", ctx), "Hi there!")
  assert.equal(interpolateVariables("Hi {{city}}!", ctx), "Hi !")
  assert.equal(interpolateVariables("You chose {{last_reply}}", ctx), "You chose gold")
  assert.equal(interpolateVariables("no braces", ctx), "no braces")
  assert.equal(interpolateVariables("{link:abc123} stays", ctx), "{link:abc123} stays")
})

// --- engine ---
const graph = (nodes: Record<string, any>, startNodeId = "m1", extra: any = {}) => ({ startNodeId, nodes, ...extra })

test("legacy waiting condition still pauses and branches on the reply (flows saved before conditions)", () => {
  const flow = graph({
    m1: { type: "message", text: "Yes or no?", next: "c" },
    c: { type: "condition", branches: [{ keyword: "yes", next: "y" }, { keyword: "no", next: "n" }], default_next: "d" },
    y: { type: "message", text: "great", next: null },
    n: { type: "message", text: "ok", next: null },
    d: { type: "message", text: "huh", next: null },
  })
  const first = advance(flow, "m1", null)
  assert.equal(first.nodeId, "c")
  assert.equal(first.actions.length, 1)
  assert.deepEqual(advance(flow, "c", "YES!").actions.map((a: any) => a.text), ["great"])
  assert.deepEqual(advance(flow, "c", "dunno").actions.map((a: any) => a.text), ["huh"])
  assert.equal(pickBranch(flow.nodes.c, "no thanks"), "n")
  assert.equal(pickBranch(flow.nodes.c, { text: "yes" }), "y")
})

test("immediate condition (wait_for_reply false) decides from tags and does not pause", () => {
  const flow = graph({
    m1: { type: "message", text: "Hello", next: "c" },
    c: { type: "condition", wait_for_reply: false, branches: [{ rules: [{ kind: "tag", tag: "vip", op: "has" }], next: "vip" }], default_next: "reg" },
    vip: { type: "message", text: "VIP offer", next: null },
    reg: { type: "message", text: "Regular offer", next: null },
  })
  assert.deepEqual(advance(flow, "m1", null, { tags: ["vip"] }).actions.map((a: any) => a.text), ["Hello", "VIP offer"])
  const reg = advance(flow, "m1", null, { tags: [] })
  assert.deepEqual(reg.actions.map((a: any) => a.text), ["Hello", "Regular offer"])
  assert.equal(reg.nodeId, null)
})

test("tag then immediate condition sees the tag; remove_tag then condition no longer sees it", () => {
  const flow = graph({
    t: { type: "tag", tag: "Hot Lead", next: "c" },
    c: { type: "condition", wait_for_reply: false, branches: [{ rules: [{ kind: "tag", tag: "hot-lead", op: "has" }], next: "yes" }], default_next: "no" },
    yes: { type: "remove_tag", tag: "hot lead", next: "c2" },
    c2: { type: "condition", wait_for_reply: false, branches: [{ rules: [{ kind: "tag", tag: "hot-lead", op: "has" }], next: "bad" }], default_next: "good" },
    no: { type: "message", text: "no tag", next: null },
    bad: { type: "message", text: "still tagged", next: null },
    good: { type: "message", text: "tag gone", next: null },
  }, "t")
  const r = advance(flow, "t", null)
  assert.deepEqual(r.actions.map((a: any) => a.kind), ["tag", "remove_tag", "message"])
  assert.equal((r.actions[2] as any).text, "tag gone")
  assert.deepEqual(r.tags, [])
})

test("set_variable saves a value (supports {{last_reply}}) that later messages and conditions use", () => {
  const flow = graph({
    c0: { type: "condition", branches: [{ keyword: "gold", next: "sv" }], default_next: null },
    sv: { type: "set_variable", name: "Plan", value: "{{last_reply}}", next: "c1" },
    c1: { type: "condition", wait_for_reply: false, branches: [{ rules: [{ kind: "variable", name: "plan", op: "equals", value: "gold" }], next: "m" }], default_next: null },
    m: { type: "message", text: "Your plan is {{plan}}", next: null },
  }, "c0")
  const r = advance(flow, "c0", "gold")
  assert.deepEqual(r.actions.map((a: any) => a.kind), ["set_variable", "message"])
  assert.deepEqual(r.actions[0], { kind: "set_variable", nodeId: "sv", name: "plan", value: "gold" })
  assert.equal((r.actions[1] as any).text, "Your plan is gold")
  assert.equal(r.variables.plan, "gold")
})

test("set_variable ignores empty names and the reserved last_reply", () => {
  const flow = graph({ s1: { type: "set_variable", name: "  ", value: "x", next: "s2" }, s2: { type: "set_variable", name: "last_reply", value: "x", next: null } }, "s1")
  assert.deepEqual(advance(flow, "s1", null).actions, [])
})

test("follows rule: unknown takes the fallback path; known routes by status", () => {
  const flow = graph({
    c: { type: "condition", wait_for_reply: false, branches: [{ rules: [{ kind: "follows", op: "is" }], next: "f" }, { rules: [{ kind: "follows", op: "is_not" }], next: "nf" }], default_next: "unk" },
    f: { type: "message", text: "thanks for following", next: null },
    nf: { type: "message", text: "please follow", next: null },
    unk: { type: "message", text: "welcome", next: null },
  }, "c")
  const text = (follows: any) => (advance(flow, "c", null, { follows }).actions[0] as any).text
  assert.equal(text("following"), "thanks for following")
  assert.equal(text("not_following"), "please follow")
  assert.equal(text("unknown"), "welcome")
  assert.equal(flowUsesFollowRule(flow), true)
  assert.equal(flowUsesRuleKind(flow, "time"), false)
})

test("time of day rule respects flow.timezone and the Asia/Kolkata default", () => {
  const nodes = {
    c: { type: "condition", wait_for_reply: false, branches: [{ rules: [{ kind: "time", from: "09:00", to: "18:00", op: "between" }], next: "open" }], default_next: "closed" },
    open: { type: "message", text: "we are open", next: null },
    closed: { type: "message", text: "we are closed", next: null },
  }
  const at = (flow: any, iso: string) => (advance(flow, "c", null, { now: new Date(iso) }).actions[0] as any).text
  assert.equal(at(graph(nodes, "c"), "2026-11-10T10:00:00Z"), "we are open") // 15:30 IST
  assert.equal(at(graph(nodes, "c"), "2026-11-10T16:00:00Z"), "we are closed") // 21:30 IST
  assert.equal(at(graph(nodes, "c", { timezone: "America/New_York" }), "2026-11-10T16:00:00Z"), "we are open") // 11:00 EST
})

test("message text rule inside a waiting condition uses the reply; quick reply payload branch works", () => {
  const flow = graph({
    c: { type: "condition", branches: [{ rules: [{ kind: "quick_reply", payload: "QR_PRICE" }], next: "p" }, { rules: [{ kind: "text", op: "contains", value: "book" }], next: "b" }], default_next: "d" },
    p: { type: "message", text: "price info", next: null },
    b: { type: "message", text: "booking info", next: null },
    d: { type: "message", text: "default", next: null },
  }, "c")
  assert.equal((advance(flow, "c", "Price", { quickReplyPayload: "QR_PRICE" }).actions[0] as any).text, "price info")
  assert.equal((advance(flow, "c", "I want to Book now").actions[0] as any).text, "booking info")
  assert.equal((advance(flow, "c", "hmm").actions[0] as any).text, "default")
})

test("AND/OR combine across kinds inside a branch (max 5 rules)", () => {
  const flow = graph({
    c: { type: "condition", wait_for_reply: false,
      branches: [{ match: "all", rules: [{ kind: "tag", tag: "vip", op: "has" }, { kind: "variable", name: "city", op: "equals", value: "pune" }, { kind: "in_window", op: "is" }], next: "a" },
                 { match: "any", rules: [{ kind: "tag", tag: "lead", op: "has" }, { kind: "variable", name: "email", op: "is_set" }], next: "b" }],
      default_next: "z" },
    a: { type: "message", text: "A", next: null }, b: { type: "message", text: "B", next: null }, z: { type: "message", text: "Z", next: null },
  }, "c")
  const go = (ctx: any) => (advance(flow, "c", null, ctx).actions[0] as any).text
  assert.equal(go({ tags: ["vip"], variables: { city: "Pune" } }), "A")
  assert.equal(go({ tags: ["vip"], variables: { city: "Pune" }, inWindow: false }), "Z")
  assert.equal(go({ tags: ["lead"] }), "B")
  assert.equal(go({ variables: { email: "a@b.c" } }), "B")
  assert.equal(go({}), "Z")
})

test("condition loops are cut at 20 hops", () => {
  const flow = graph({ c: { type: "condition", wait_for_reply: false, branches: [], default_next: "c" } }, "c")
  const r = advance(flow, "c", null)
  assert.equal(r.truncated, true)
  assert.equal(r.nodeId, null)
})

test("simulate: carries tags and variables across steps, takes test data, reports waitingFor", () => {
  const flow = graph({
    m1: { type: "message", text: "Which plan?", quick_replies: [{ title: "Gold", payload: "QR_GOLD" }, { title: "Silver", payload: "QR_SILVER" }], next: "c" },
    c: { type: "condition", branches: [{ rules: [{ kind: "quick_reply", payload: "QR_GOLD" }], next: "sv" }, { keyword: "silver", next: "s" }], default_next: null },
    sv: { type: "set_variable", name: "plan", value: "gold", next: "tg" },
    tg: { type: "tag", tag: "gold-buyer", next: "c2" },
    c2: { type: "condition", wait_for_reply: false, branches: [{ rules: [{ kind: "tag", tag: "gold-buyer", op: "has" }, { kind: "variable", name: "plan", op: "equals", value: "gold" }], next: "m2" }], default_next: "m3" },
    m2: { type: "message", text: "Gold it is, {{name|friend}}", next: null },
    m3: { type: "message", text: "other", next: null },
    s: { type: "message", text: "silver", next: null },
  })
  const start = simulate(flow, [])
  assert.deepEqual(start.quickReplies, ["Gold", "Silver"])
  assert.deepEqual(start.waitingFor, ["silver"])
  const tapped = simulate(flow, ["Gold"], { variables: { name: "Asha" } })
  assert.ok(tapped.lines.some((l) => l.text === "Gold it is, Asha"))
  assert.deepEqual(tapped.tags, ["gold-buyer"])
  assert.deepEqual(tapped.variables, { plan: "gold" })
  assert.equal(tapped.finished, true)
  const typed = simulate(flow, ["gold"]) // typing the label counts as tapping the chip
  assert.ok(typed.lines.some((l) => l.text === "Gold it is, friend"))
})

test("simulate with test data: pretend the person follows us / has a tag", () => {
  const flow = graph({
    c: { type: "condition", wait_for_reply: false, branches: [{ rules: [{ kind: "follows", op: "is" }], next: "f" }], default_next: "n" },
    f: { type: "message", text: "follower", next: null },
    n: { type: "message", text: "not sure", next: null },
  }, "c")
  assert.ok(simulate(flow, [], { follows: "following" }).lines.some((l) => l.text === "follower"))
  assert.ok(simulate(flow, [], {}).lines.some((l) => l.text === "not sure"))
})

test("flowNeedsContactFacts only for rules or {{variables}}", () => {
  assert.equal(flowNeedsContactFacts(graph({ m: { type: "message", text: "hi", next: null }, c: { type: "condition", branches: [{ keyword: "x", next: "m" }] } })), false)
  assert.equal(flowNeedsContactFacts(graph({ m: { type: "message", text: "hi {{name}}", next: null } })), true)
  assert.equal(flowNeedsContactFacts(graph({ c: { type: "condition", branches: [{ rules: [{ kind: "tag", tag: "a", op: "has" }], next: "m" }] } })), true)
})

test("contact variables: standard fields + custom fields; set variable goes to the right place", () => {
  assert.deepEqual(contactToVariables({ name: " Asha ", email: null, phone: "999", custom_fields: { Budget: 5000, source: "ref:summer", nested: { a: 1 } } }), {
    name: "Asha", phone: "999", budget: "5000", source: "ref:summer",
  })
  assert.deepEqual(contactToVariables(null), {})
  assert.deepEqual(applyVariable({ custom_fields: { a: "1" } }, "City", "Pune"), { columns: {}, custom_fields: { a: "1", city: "Pune" } })
  assert.deepEqual(applyVariable({ custom_fields: {} }, "email", "a@b.c"), { columns: { email: "a@b.c" }, custom_fields: {} })
  assert.equal(applyVariable({}, "last_reply", "x"), null)
  assert.equal(applyVariable({}, "  ", "x"), null)
})

test("sanitizeResponseContent clamps conditions inside a stored flow", () => {
  const rules = Array.from({ length: 8 }, (_, i) => ({ kind: "tag", tag: `t${i}`, op: "has" }))
  const out = sanitizeResponseContent({
    flow: { startNodeId: "c", timezone: "Mars/Base", nodes: {
      c: { type: "condition", wait_for_reply: 0, branches: [{ rules, match: "weird", next: "x" }, { keyword: "hi", next: "y" }, { rules: [{ kind: "bogus" }], next: "z" }], default_next: null },
      s: { type: "set_variable", name: "My Var", value: "x".repeat(900), next: null },
    } },
  })
  assert.equal(out.flow.timezone, "Asia/Kolkata")
  assert.equal(out.flow.nodes.c.branches[0].rules.length, 5)
  assert.equal(out.flow.nodes.c.branches[0].match, "all")
  assert.equal(out.flow.nodes.c.wait_for_reply, true) // 0 !== false
  assert.equal(out.flow.nodes.c.branches[1].keyword, "hi")
  assert.equal("rules" in out.flow.nodes.c.branches[2], false)
  assert.equal(out.flow.nodes.s.name, "my_var")
  assert.equal(out.flow.nodes.s.value.length, 500)
})

import { dateAtLocalTime } from "../lib/flows/conditions.ts"

test("dateAtLocalTime builds a moment whose local time in the zone is the requested one", () => {
  for (const tz of ["Asia/Kolkata", "UTC", "America/New_York", "Asia/Tokyo"]) {
    for (const hhmm of ["00:00", "09:30", "21:45", "23:59"]) {
      const d = dateAtLocalTime(hhmm, tz, new Date("2026-11-10T12:00:00Z"))!
      const [h, m] = hhmm.split(":").map(Number)
      assert.equal(minutesInZone(d, tz), h * 60 + m, `${tz} ${hhmm}`)
    }
  }
  assert.equal(dateAtLocalTime("9am", "UTC"), null)
})

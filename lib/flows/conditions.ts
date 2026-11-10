/**
 * Condition rules for the flow builder's condition node, evaluated by the pure flow walker.
 *
 * Who calls this: lib/flows/engine.ts (picks the branch of a condition node and fills {{variables}} in messages),
 * lib/messaging/flow-runner.ts (builds the FlowContext from the contact and decides whether a follow check is needed),
 * lib/automations/sanitize.ts (clamps stored conditions), components/dashboard/ConditionRulesEditor.tsx and
 * app/dashboard/flow-builder/page.tsx (shared limits/labels), tests/batch1-conditions.test.ts.
 * Why it exists: a condition used to be one keyword per branch ("if the reply contains X"). Now a branch holds up to 5
 * rules joined by AND or OR, over: saved variables (answers from lead-capture questions, custom fields), contact tags,
 * and attributes (follows us, still inside the 24 hour window, time of day, the message text, the tapped quick reply).
 * Everything here is pure (no network, no database): the runner fetches the facts once and passes them in as a
 * FlowContext, so the in-browser simulator and production make the same decision for the same facts.
 *
 * Rule shapes (stored on a branch as `rules`, with `match: "all" | "any"`, default "all"):
 *   { kind: "variable", name, op: equals|not_equals|contains|is_set|not_set|gt|lt, value? }
 *   { kind: "tag", tag, op: has|not_has }
 *   { kind: "follows", op: is|is_not }          // does the person follow the account (see unknown handling below)
 *   { kind: "in_window", op: is|is_not }        // are we still inside the 24 hour messaging window
 *   { kind: "time", from: "HH:MM", to: "HH:MM", op: between|not_between }   // in the flow's time zone
 *   { kind: "text", op: contains|not_contains|equals|keyword|phrase, value } // the person's latest message; keyword = any of a comma list as whole words, phrase = the whole value as one phrase (what the old single keyword did)
 *   { kind: "quick_reply", payload }            // the chip that was just tapped
 *
 * "Follows us" and unknown: Instagram only tells us when the person gave consent and the call succeeds
 * (lib/messaging/follow-check.ts). When the answer is "unknown" BOTH "follows us" and "does not follow us" evaluate to
 * false, so the flow takes its fallback path instead of guessing.
 */
import { matchesAnyKeyword, textMatchesKeyword, tokenize } from "../matching/keywords.ts"

export const MAX_RULES_PER_CONDITION = 5
export const DEFAULT_TIMEZONE = "Asia/Kolkata"

export type FollowState = "following" | "not_following" | "unknown"

export type CondRule =
  | { kind: "variable"; name: string; op: "equals" | "not_equals" | "contains" | "is_set" | "not_set" | "gt" | "lt"; value?: string }
  | { kind: "tag"; tag: string; op: "has" | "not_has" }
  | { kind: "follows"; op: "is" | "is_not" }
  | { kind: "in_window"; op: "is" | "is_not" }
  | { kind: "time"; from: string; to: string; op: "between" | "not_between" }
  | { kind: "text"; op: "contains" | "not_contains" | "equals" | "keyword" | "phrase"; value: string }
  | { kind: "quick_reply"; payload: string }

/** The facts a condition can look at. Everything optional so a caller only supplies what it knows. */
export interface FlowContext {
  /** The person's latest message. */
  text?: string | null
  /** message.quick_reply.payload of the tapped chip, when the latest message was a chip tap. */
  quickReplyPayload?: string | null
  /** Saved values: contact name/email/phone, custom fields (lead-capture answers, source), variables set by the flow. */
  variables?: Record<string, string>
  tags?: string[]
  follows?: FollowState
  /** Inside the 24 hour window. Defaults to true (a flow that is running was triggered by a message). */
  inWindow?: boolean
  now?: Date
  /** IANA zone for time rules. Defaults to Asia/Kolkata. */
  timezone?: string
}

const cut = (s: string, max: number) => Array.from(s).slice(0, max).join("")

/** Variable names are lowercase letters, digits and underscore, up to 30 (so they are safe as custom field keys). */
export function normalizeVarName(name: unknown): string {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30)
}

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/
function toMinutes(hhmm: string): number | null {
  const m = HHMM.exec(hhmm)
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

/** Minutes since local midnight in `timeZone` (falls back to the default zone if the name is invalid). */
export function minutesInZone(now: Date, timeZone: string): number {
  const read = (tz: string) => {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now)
    const h = Number(parts.find((p) => p.type === "hour")?.value)
    const m = Number(parts.find((p) => p.type === "minute")?.value)
    return (h % 24) * 60 + m
  }
  try {
    return read(timeZone)
  } catch {
    return read(DEFAULT_TIMEZONE)
  }
}

/** True when `minutes` is in [from, to). A range that crosses midnight (22:00 to 06:00) wraps. from == to means all day. */
export function timeInRange(minutes: number, from: string, to: string): boolean {
  const a = toMinutes(from)
  const b = toMinutes(to)
  if (a === null || b === null) return false
  if (a === b) return true
  return a < b ? minutes >= a && minutes < b : minutes >= a || minutes < b
}

/** Cleans stored rules: known kinds only, fields cut to size, at most MAX_RULES_PER_CONDITION. */
export function sanitizeRules(input: unknown): CondRule[] {
  if (!Array.isArray(input)) return []
  const out: CondRule[] = []
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue
    const r = raw as any
    const val = typeof r.value === "string" ? cut(r.value.trim(), 200) : ""
    let rule: CondRule | null = null
    switch (r.kind) {
      case "variable": {
        const name = normalizeVarName(r.name)
        const ops = ["equals", "not_equals", "contains", "is_set", "not_set", "gt", "lt"]
        if (name && ops.includes(r.op)) rule = { kind: "variable", name, op: r.op, value: val }
        break
      }
      case "tag": {
        const tag = typeof r.tag === "string" ? cut(r.tag.trim(), 30) : ""
        if (tag && (r.op === "has" || r.op === "not_has")) rule = { kind: "tag", tag, op: r.op }
        break
      }
      case "follows":
        rule = { kind: "follows", op: r.op === "is_not" ? "is_not" : "is" }
        break
      case "in_window":
        rule = { kind: "in_window", op: r.op === "is_not" ? "is_not" : "is" }
        break
      case "time":
        if (typeof r.from === "string" && typeof r.to === "string" && toMinutes(r.from) !== null && toMinutes(r.to) !== null) {
          rule = { kind: "time", from: r.from, to: r.to, op: r.op === "not_between" ? "not_between" : "between" }
        }
        break
      case "text":
        if (val && ["contains", "not_contains", "equals", "keyword", "phrase"].includes(r.op)) rule = { kind: "text", op: r.op, value: val }
        break
      case "quick_reply": {
        const payload = typeof r.payload === "string" ? cut(r.payload.trim(), 200) : ""
        if (payload) rule = { kind: "quick_reply", payload }
        break
      }
    }
    if (rule) out.push(rule)
    if (out.length >= MAX_RULES_PER_CONDITION) break
  }
  return out
}

function lookupVariable(ctx: FlowContext, name: string): string | undefined {
  const wanted = normalizeVarName(name)
  if (wanted === "last_reply") return ctx.text ?? undefined
  for (const [k, v] of Object.entries(ctx.variables ?? {})) {
    if (normalizeVarName(k) === wanted) return v == null ? undefined : String(v)
  }
  return undefined
}

/**
 * Tags are stored cleaned (lib/contacts/segments.ts cleanTag: lowercase, spaces to "-", only letters/digits/_/-/Devanagari,
 * 30 chars), so "Warm Lead" is saved as "warm-lead". This copy lets pure code compare a typed tag with a stored one.
 */
export function tagKey(raw: unknown): string {
  if (typeof raw !== "string") return ""
  return raw.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_\-\u0900-\u097F]/g, "").slice(0, 30)
}

const norm = (s: string) => tokenize(s).join(" ")

/** Evaluates one rule against the facts. Unknown facts make a rule false, never throw. */
export function evaluateRule(rule: CondRule, ctx: FlowContext): boolean {
  switch (rule.kind) {
    case "variable": {
      const v = lookupVariable(ctx, rule.name)
      const have = v !== undefined && v.trim() !== ""
      const want = rule.value ?? ""
      switch (rule.op) {
        case "is_set": return have
        case "not_set": return !have
        case "equals": return have && v!.trim().toLowerCase() === want.trim().toLowerCase()
        case "not_equals": return !have || v!.trim().toLowerCase() !== want.trim().toLowerCase()
        case "contains": return have && want.trim() !== "" && norm(v!).includes(norm(want))
        case "gt":
        case "lt": {
          const a = parseFloat(v ?? "")
          const b = parseFloat(want)
          if (!Number.isFinite(a) || !Number.isFinite(b)) return false
          return rule.op === "gt" ? a > b : a < b
        }
      }
      return false
    }
    case "tag": {
      const want = tagKey(rule.tag)
      const has = want !== "" && (ctx.tags ?? []).some((t) => tagKey(t) === want)
      return rule.op === "has" ? has : !has
    }
    case "follows": {
      if (ctx.follows !== "following" && ctx.follows !== "not_following") return false // unknown: neither is true
      return rule.op === "is" ? ctx.follows === "following" : ctx.follows === "not_following"
    }
    case "in_window": {
      const inside = ctx.inWindow !== false
      return rule.op === "is" ? inside : !inside
    }
    case "time": {
      const minutes = minutesInZone(ctx.now ?? new Date(), ctx.timezone || DEFAULT_TIMEZONE)
      const inside = timeInRange(minutes, rule.from, rule.to)
      return rule.op === "between" ? inside : !inside
    }
    case "text": {
      const t = ctx.text ?? ""
      switch (rule.op) {
        case "contains": return norm(rule.value) !== "" && norm(t).includes(norm(rule.value))
        case "not_contains": return !(norm(rule.value) !== "" && norm(t).includes(norm(rule.value)))
        case "equals": return norm(t) !== "" && norm(t) === norm(rule.value)
        case "keyword": return matchesAnyKeyword(t, rule.value)
        case "phrase": return textMatchesKeyword(t, rule.value)
      }
      return false
    }
    case "quick_reply":
      return !!ctx.quickReplyPayload && ctx.quickReplyPayload === rule.payload
  }
  return false
}

export interface BranchLike {
  keyword?: string
  rules?: unknown
  match?: string
}

/**
 * The rules of a branch: the legacy `keyword` (whole-word match, exactly as before) counts as the first rule, then the
 * `rules` array; at most 5 in total.
 */
export function branchRules(branch: BranchLike): CondRule[] {
  const rules: CondRule[] = []
  const kw = typeof branch.keyword === "string" ? branch.keyword.trim() : ""
  // The old single keyword matched the whole string as one phrase; "phrase" keeps that behaviour exactly.
  if (kw) rules.push({ kind: "text", op: "phrase", value: kw })
  rules.push(...sanitizeRules(branch.rules))
  return rules.slice(0, MAX_RULES_PER_CONDITION)
}

/** Does this branch fire? No rules at all never fires (so a bare branch cannot swallow the fallback path). */
export function evaluateBranch(branch: BranchLike, ctx: FlowContext): boolean {
  const rules = branchRules(branch)
  if (rules.length === 0) return false
  return branch.match === "any" ? rules.some((r) => evaluateRule(r, ctx)) : rules.every((r) => evaluateRule(r, ctx))
}

/** True when any condition in the flow uses a rule of this kind. */
export function flowUsesRuleKind(flow: { nodes?: Record<string, any> } | null | undefined, kind: CondRule["kind"]): boolean {
  for (const node of Object.values(flow?.nodes ?? {})) {
    if (node?.type !== "condition") continue
    for (const b of node.branches ?? []) if (sanitizeRules(b?.rules).some((r) => r.kind === kind)) return true
  }
  return false
}

/** True when any condition in the flow asks "follows us", so the runner only calls Instagram when it must. */
export function flowUsesFollowRule(flow: { nodes?: Record<string, any> } | null | undefined): boolean {
  return flowUsesRuleKind(flow, "follows")
}

/**
 * Fills {{name}} and {{name|fallback}} in a message. {{last_reply}} is the person's latest message. A variable with no
 * value becomes its fallback, or nothing. Names are matched case-insensitively.
 */
export function interpolateVariables(text: string, ctx: FlowContext): string {
  if (!text || !text.includes("{{")) return text
  return text.replace(/\{\{\s*([A-Za-z0-9_ ]{1,30}?)\s*(?:\|([^}]{0,60}))?\}\}/g, (_m, name: string, fallback?: string) => {
    const v = lookupVariable(ctx, name)
    if (v !== undefined && v.trim() !== "") return v
    return fallback ? fallback.trim() : ""
  })
}

/**
 * True when running this flow needs facts about the person (saved variables / tags): some condition has rules, or some
 * text uses {{variables}}. Lets the runner skip the contact lookup for plain flows, so they cost exactly what they did
 * before this feature.
 */
export function flowNeedsContactFacts(flow: { nodes?: Record<string, any> } | null | undefined): boolean {
  for (const node of Object.values(flow?.nodes ?? {})) {
    if (!node) continue
    if (node.type === "condition" && (node.branches ?? []).some((b: any) => sanitizeRules(b?.rules).length > 0)) return true
    if ((node.type === "message" && String(node.text ?? "").includes("{{")) || (node.type === "set_variable" && String(node.value ?? "").includes("{{"))) return true
  }
  return false
}

/**
 * A Date whose wall-clock time in `timeZone` is `hhmm` (today's date in UTC as the base). Used by the simulator's
 * "pretend it is 21:30" control so time-of-day rules can be tested at any hour. Returns null for a bad HH:MM.
 */
export function dateAtLocalTime(hhmm: string, timeZone: string, base: Date = new Date()): Date | null {
  const want = toMinutes(hhmm)
  if (want === null) return null
  const midnightUtc = Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate())
  let candidate = new Date(midnightUtc + want * 60_000)
  const got = minutesInZone(candidate, timeZone)
  let diff = want - got
  if (diff > 12 * 60) diff -= 24 * 60
  if (diff < -12 * 60) diff += 24 * 60
  candidate = new Date(candidate.getTime() + diff * 60_000)
  return candidate
}

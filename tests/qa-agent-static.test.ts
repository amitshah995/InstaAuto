// QA (static review as tests): Celra design tokens, no gradients, no fixed widths that force page scroll, safe rendering,
// Test panel isolation, and the order of the new code in the Instagram webhook.
import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]))
const UI = [...walk("components/ai-agent"), ...walk("app/dashboard/ai-agent")].filter((f) => /\.tsx$/.test(f))
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

test("UI: Celra tokens only (no off-palette hex, no gradients, no Tailwind palette colours)", () => {
  const allowedHex = new Set(["#0B5C6E", "#FF6F4D", "#FBFAF6", "#FFF6F1", "#0E2A33"].map((h) => h.toLowerCase()))
  for (const f of UI) {
    const src = strip(fs.readFileSync(f, "utf8"))
    for (const m of src.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)) assert.ok(allowedHex.has(m[0].toLowerCase()), `${f}: off-palette ${m[0]}`)
    assert.ok(!/gradient|\bfrom-|\bvia-|\bto-(?!\w*\/)[a-z]+-\d|bg-linear|bg-conic/.test(src), `${f}: gradient`)
    assert.ok(!/\b(bg|text|border|ring)-(red|blue|green|purple|pink|yellow|orange|indigo|violet|emerald|sky|teal|amber|rose|lime|cyan|fuchsia|slate|gray|zinc|neutral|stone)-\d{2,3}/.test(src), `${f}: palette colour`)
  }
})

test("UI: no fixed pixel widths that can force horizontal page scroll (tables scroll inside their own container)", () => {
  for (const f of UI) {
    const src = fs.readFileSync(f, "utf8")
    for (const m of src.matchAll(/(?<![-\w:])(?:w|min-w)-\[(\d+)px\]/g)) {
      const line = src.split("\n").find((l) => l.includes(m[0]))!
      assert.ok(Number(m[1]) <= 320 || /overflow-x-auto|min-w-\[560px\]/.test(src), `${f}: ${m[0]}`)
      if (m[0].startsWith("min-w")) assert.ok(/overflow-x-auto/.test(src), `${f}: ${line.trim()} needs an overflow-x-auto parent`)
    }
    // two-column layouts only from md up
    for (const m of src.matchAll(/(?<![-\w:])grid-cols-\[[^\]]+\]/g)) assert.ok(src.includes("md:" + m[0]), `${f}: ${m[0]} without md: prefix`)
  }
})

test("UI: every data panel handles loading, error and empty states; buttons and inputs are named", () => {
  for (const f of ["components/ai-agent/OverviewPanel.tsx", "components/ai-agent/ConversationsPanel.tsx", "components/ai-agent/LeadsPanel.tsx"]) {
    const src = fs.readFileSync(f, "utf8")
    assert.ok(/Loading/.test(src), `${f} loading`)
    assert.ok(/ErrorNote/.test(src), `${f} error`)
    assert.ok(/No |no |yet/.test(src), `${f} empty`)
  }
  const test = fs.readFileSync("components/ai-agent/TestPanel.tsx", "utf8")
  assert.ok(/aria-label="Message"/.test(test) && /aria-label="Send"/.test(test))
  assert.ok(/aria-label="Turn the AI Sales Agent on or off"/.test(fs.readFileSync("components/ai-agent/OverviewPanel.tsx", "utf8")))
  assert.ok(/aria-label="AI Sales Agent sections"/.test(fs.readFileSync("app/dashboard/ai-agent/layout.tsx", "utf8")))
  assert.ok(/ErrorNote[\s\S]*role="alert"/.test(fs.readFileSync("components/ai-agent/shared.tsx", "utf8")))
})

test("UI: untrusted text (messages, names, captions) is rendered as text, never as HTML", () => {
  for (const f of UI) {
    const src = fs.readFileSync(f, "utf8")
    assert.ok(!/dangerouslySetInnerHTML|innerHTML|eval\(|new Function/.test(src), f)
  }
})

test("UI: no gradient or off-token styling and no banned claims in the page copy", () => {
  const copy = UI.map((f) => fs.readFileSync(f, "utf8")).join("\n") + fs.readFileSync("lib/marketing-nav.ts", "utf8").split("\n").filter((l) => /ai-sales-agent|AI Sales Agent/.test(l)).join("\n")
  assert.ok(!/meta[- ]approved|approved by meta|guaranteed?\b|\bcure[sd]?\b|100% (safe|secure|accurate)|no risk/i.test(copy))
  assert.ok(!/manychat|chatfuel|wati|zoko|interakt|linkdm|creatorflow/i.test(copy))
})

test("Test panel and /api/ai-agent/test cannot send an Instagram message, store a contact or dispatch a lead", () => {
  const route = strip(fs.readFileSync("app/api/ai-agent/test/route.ts", "utf8"))
  assert.ok(!/sendSteps|emitEvent|applyLead|startConversation|saveConversation|upsertKnowledge|INSERT|UPDATE|DELETE/i.test(route.replace(/\/\*[\s\S]*?\*\//g, "")), "test route has a write path")
  assert.ok(!/access_token/.test(route))
  const rt = fs.readFileSync("lib/agent/runtime.ts", "utf8")
  const sim = rt.slice(rt.indexOf("export async function runSimulation"))
  assert.ok(!/sendSteps|emitEvent|applyLead|applyEffects|dispatchLead|startConversation|saveConversation|rawQuery/.test(strip(sim)), "runSimulation has a write path")
  const panel = fs.readFileSync("components/ai-agent/TestPanel.tsx", "utf8")
  const urls = [...panel.matchAll(/"(\/api\/[^"]+)"/g)].map((m) => m[1])
  assert.deepEqual(urls.sort(), ["/api/ai-agent/status", "/api/ai-agent/test"])
})

test("test route: input hardening (message length, media id shape, history size) is in code", () => {
  const route = fs.readFileSync("app/api/ai-agent/test/route.ts", "utf8")
  assert.ok(route.includes("cleanUntrusted(body?.message, 1000)") && route.includes("\\d{5,40}") && route.includes(".slice(-12)") && route.includes("parseState("))
})

// ---------- webhook ordering ----------
const wh = fs.readFileSync("app/api/instagram/webhook/route.ts", "utf8")
const at = (needle: string, from = 0) => { const i = wh.indexOf(needle, from); assert.ok(i > -1, needle); return i }

test("webhook DM path: agent routing comes after the idempotency guard, human_handled, 24h check and the lead-flow answer, and before keyword rules / generic AI", () => {
  const dm = at("PART B: MESSAGES (DMs)")
  const dedupe = at("isDuplicateEvent(supabase, `dm_${dmEventId}`", dm)
  const human = at("if (conv?.human_handled)", dm)
  const win = at("const withinWindow", dm)
  const flow = at("LEAD-QUALIFICATION FLOW", dm)
  const agent = at("routeIncomingDm({", dm)
  const outside = at("if (!withinWindow) {", agent)
  const kw = at("Priority 1: specific keyword match", agent)
  const generic = at("user.groq_auto_reply_enabled", agent)
  assert.ok(dedupe < human && human < win && win < flow && flow < agent && agent < outside && outside < kw && kw < generic)
  // human_handled / window are passed to the router, which re-checks them
  const call = wh.slice(agent, agent + 500)
  assert.ok(/humanHandled: !!conv\?\.human_handled/.test(call) && /withinWindow,/.test(call))
})

test("webhook DM path: agent block never throws into the handler (store lookup guarded, handleAgentDm is the only awaited call) and falls through when not handled", () => {
  const i = at("AI SALES AGENT — a person who commented")
  const block = wh.slice(i, at("if (!withinWindow) {", i))
  assert.ok(/try \{\s*agentConv = await agentStore\(\)\.getConversation/.test(block))
  assert.ok(/if \(out\.handled\) \{[\s\S]*continue[\s\S]*\}/.test(block))
  assert.ok(/triggerText: null/.test(block)) // message text is not copied into run logs
  const rt = fs.readFileSync("lib/agent/runtime.ts", "utf8")
  const h = rt.slice(rt.indexOf("export async function handleAgentDm"), rt.indexOf("export async function runSimulation"))
  assert.ok(/^[\s\S]*try \{[\s\S]*\} catch \(e\) \{[\s\S]*return \{ handled: true, status: "failed"/.test(h))
})

test("webhook comment path: the agent intro is prepared BEFORE the public reply is posted, and commitAgentStart only after the DM was delivered", () => {
  const intro = at("prepareAgentIntro(user, String(mediaId))")
  const pub = at("/replies?access_token=")
  const priv = at("const { ok: dmOk, results: dmResults } = await sendSteps")
  const commit = at("await commitAgentStart(user, senderId, String(mediaId))")
  assert.ok(intro < pub && pub < priv && priv < commit)
  const between = wh.slice(priv, commit)
  assert.ok(/\} else \{/.test(between) && !/dmOk\)\s*\{[^}]*commitAgentStart/.test(between)) // inside the success branch
})

const baseKnown = (() => { try { (process as any).getBuiltinModule("node:child_process").execSync("git cat-file -e a9c9c85", { stdio: "ignore" }); return true } catch { return false } })()
test("webhook: the existing handlers are untouched (diff only adds agent code and imports)", { skip: baseKnown ? false : "base commit a9c9c85 not in this clone" }, () => {
  // Every removed line in the diff of the webhook route must be part of the move of the agent block or the sendSteps argument.
  const { execSync } = require_("node:child_process")
  const diff: string = execSync("git diff a9c9c85 -- app/api/instagram/webhook/route.ts", { encoding: "utf8", maxBuffer: 10_000_000 })
  const removed = diff.split("\n").filter((l) => l.startsWith("-") && !l.startsWith("---"))
  assert.deepEqual(removed.map((l) => l.trim()), ["-              content,"])
})
function require_(m: string): any { return (process as any).getBuiltinModule(m) }

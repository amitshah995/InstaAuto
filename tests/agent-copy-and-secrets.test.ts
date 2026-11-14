// Guards for copy and secrets in the AI Sales Agent files: no competitor names, no "Meta-approved" claims, no logging of PII/keys.
import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { MENUS } from "../lib/marketing-nav.ts"

const ROOT = path.resolve(import.meta.dirname, "..")
function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]))
}
const files = [...walk(path.join(ROOT, "lib/agent")), ...walk(path.join(ROOT, "components/ai-agent")), ...walk(path.join(ROOT, "app/dashboard/ai-agent")), ...walk(path.join(ROOT, "app/api/ai-agent"))]

test("agent files exist (sanity)", () => assert.ok(files.length > 25))

test("no competitor names and no 'Meta-approved' style claims in agent code or copy", () => {
  for (const f of files) {
    const src = fs.readFileSync(f, "utf8")
    assert.ok(!/manychat|chatfuel|linkdm|creatorflow|instachamp|zoko|wati|interakt/i.test(src), `competitor name in ${f}`)
    assert.ok(!/meta[- ]approved|approved by meta|official meta partner/i.test(src), `approval claim in ${f}`)
  }
})

test("marketing page copy is honest: no approval claim, no medical or result guarantee", () => {
  const item = MENUS.flatMap((m) => m.items).find((i) => i.href === "/features/ai-sales-agent")!
  assert.ok(item?.page)
  const copy = JSON.stringify(item.page)
  assert.ok(!/approved|guarantee|cure|100%|best results/i.test(copy))
  assert.ok(/consent/i.test(copy) && /human|person/i.test(copy))
})

test("no console logging of phone, email, key, token or message text in lib/agent", () => {
  for (const f of walk(path.join(ROOT, "lib/agent")).filter((x) => x.endsWith(".ts"))) {
    const lines = fs.readFileSync(f, "utf8").split("\n").filter((l) => /console\.(log|error|warn|info)/.test(l))
    for (const l of lines) assert.ok(!/(phone|email|e164|apiKey|api_key|token|secret|userText|rawMessage|\btext\b|\.reply)/i.test(l.replace(/access_token/g, "")), `risky log in ${f}: ${l.trim()}`)
  }
})

test("API routes never return the stored AiSend key", () => {
  const src = fs.readFileSync(path.join(ROOT, "app/api/ai-agent/aisend/route.ts"), "utf8")
  assert.ok(!/secret:|apiKey:\s*c\./.test(src))
  const store = fs.readFileSync(path.join(ROOT, "lib/agent/store.ts"), "utf8")
  const getConnector = store.slice(store.indexOf("async getConnector"), store.indexOf("async saveConnector"))
  assert.ok(!/\bsecret\b/.test(getConnector.replace(/--.*$/gm, "").replace(/never returns the key/gi, "")))
})

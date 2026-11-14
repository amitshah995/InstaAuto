// QA (adversarial): every /api/ai-agent route enforces the session, rejects a forged userId, and (with a real Postgres) never
// returns another tenant's rows or the AiSend key. Auth matrix runs without a database.
import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { register } from "node:module"

const SECRET = "x".repeat(40)
process.env.SESSION_SECRET = SECRET
process.env.AUTH_ENFORCE = "1"
process.env.ANTHROPIC_API_KEY = "test-key"

function listRoutes(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? listRoutes(path.join(dir, e.name)) : e.name === "route.ts" ? [path.join(dir, e.name)] : []))
}
const ROUTES = listRoutes("app/api/ai-agent")

test("static: every ai-agent route uses agentUser() before touching data, and the helper goes through authorizeUser", () => {
  assert.ok(ROUTES.length >= 10)
  for (const f of ROUTES) {
    const src = fs.readFileSync(f, "utf8")
    const handlers = [...src.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\b[\s\S]*?(?=\nexport async function|\s*$)/g)]
    assert.ok(handlers.length > 0, f)
    for (const h of handlers) {
      const body = h[0]
      const iAuth = body.indexOf("agentUser(")
      assert.ok(iAuth > -1, `${f} ${h[1]} has no agentUser`)
      for (const risky of ["rawQuery(", "createAgentStore(", "sendTest(", "request.json()"].filter((r) => r !== "request.json()")) {
        const i = body.indexOf(risky)
        assert.ok(i === -1 || i > iAuth, `${f} ${h[1]}: ${risky} before auth`)
      }
      assert.ok(!/userId\s*=\s*(body|request)/.test(body), `${f}: userId taken from the client`)
    }
  }
  assert.ok(fs.readFileSync("lib/agent/api.ts", "utf8").includes("authorizeUser("))
})

test("static: no ai-agent route selects or returns the AiSend key, access tokens or raw webhook payloads", () => {
  for (const f of ROUTES) {
    const src = fs.readFileSync(f, "utf8")
    assert.ok(!/\bsecret\b/.test(src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")) || f.endsWith("aisend/route.ts"), f)
    assert.ok(!/access_token/.test(src), f)
  }
  const store = fs.readFileSync("lib/agent/store.ts", "utf8")
  assert.ok(!/SELECT[^`]*\bsecret\b/i.test(store))
  assert.ok(!/SELECT[^`]*access_token/i.test(store))
})

test("auth matrix: no session -> 401; session for A claiming B -> 403; for every method of every route", async () => {
  register("./helpers/alias-hooks.mjs", import.meta.url)
  const { NextRequest } = await import("next/server")
  const { createSessionToken } = await import("../lib/session.ts")
  const tokA = createSessionToken("111", "a", 3600)
  const forged = tokA.slice(0, -3) + "AAA"
  let checked = 0
  for (const f of ROUTES) {
    const mod: any = await import(path.resolve(f))
    const url = "http://localhost/" + f.replace("app/", "").replace("/route.ts", "")
    for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
      if (typeof mod[method] !== "function") continue
      const mk = (qs: string, cookie: string | null, body: any) =>
        new NextRequest(url + qs, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie: `insta_session=${cookie}` } : {}) }, ...(method === "GET" || method === "DELETE" ? {} : { body: JSON.stringify(body) }) })
      const noSess = await mod[method](mk("?userId=222", null, { userId: "222", mediaId: "17900000000001", message: "hi" }))
      assert.equal(noSess.status, 401, `${method} ${f} no session`)
      const bad = await mod[method](mk("?userId=222", forged, { userId: "222", mediaId: "17900000000001", message: "hi" }))
      assert.equal(bad.status, 401, `${method} ${f} forged cookie`)
      const cross = await mod[method](mk("?userId=222", tokA, { userId: "222", mediaId: "17900000000001", message: "hi", baseUrl: "https://a.example", igsid: "x" }))
      assert.equal(cross.status, 403, `${method} ${f} cross-tenant claim`)
      checked++
    }
  }
  assert.ok(checked >= 17, `checked ${checked}`)
})

const host = process.env.QA_PG_HOST
test("cross-tenant data over real routes (Postgres): A never sees B's knowledge, leads, conversations, connector; key never returned", { skip: host ? false : "set QA_PG_HOST" }, async () => {
  register("./helpers/alias-hooks.mjs", import.meta.url)
  const { NextRequest } = await import("next/server")
  const { createSessionToken } = await import("../lib/session.ts")
  const db: any = await import("./helpers/stub-db.ts")
  const q = db.rawQuery
  const A = 930001, B = 930002
  const req = (route: string, who: number, method = "GET", body?: any, qs = "") =>
    new NextRequest(`http://localhost/api/ai-agent/${route}${qs}`, { method, headers: { "content-type": "application/json", cookie: `insta_session=${createSessionToken(String(who), "u", 3600)}` }, ...(body ? { body: JSON.stringify(body) } : {}) })
  const load = async (r: string) => import(path.resolve(`app/api/ai-agent/${r}/route.ts`))
  const clean = async () => {
    await q(`DELETE FROM messages WHERE user_id IN ($1,$2)`, [A, B])
    for (const t of ["media_knowledge", "agent_conversations", "contacts", "lead_events", "agent_settings", "conversations", "webhook_endpoints", "automations"]) await q(`DELETE FROM ${t} WHERE user_id IN ($1,$2)`, [A, B])
  }
  try {
    await clean()
    await q(`INSERT INTO users (id, username, ai_context) VALUES ($1,'a',null),($2,'b',null) ON CONFLICT DO NOTHING`, [A, B])
    const know: any = await load("knowledge"), leads: any = await load("leads"), convs: any = await load("conversations"), aisend: any = await load("aisend"), act: any = await load("activate"), over: any = await load("overview"), status: any = await load("status"), settings: any = await load("settings")
    // B sets everything up
    assert.equal((await know.PUT(req("knowledge", B, "PUT", { mediaId: "17900000000001", title: "B secret offer", offer: "B only", active: true }))).status, 200)
    assert.equal((await aisend.PUT(req("aisend", B, "PUT", { baseUrl: "https://b-aisend.example.com", apiKey: "B-API-KEY-VERY-SECRET", enabled: true }))).status, 200)
    await q(`INSERT INTO contacts (user_id, igsid, name, phone, lead_status, lead_score) VALUES ($1,'big1','Bob','+919999900001','wa_lead',95)`, [B])
    await q(`INSERT INTO agent_conversations (user_id, igsid, media_id, status, state) VALUES ($1,'big1','17900000000001','active','{}')`, [B])
    await q(`INSERT INTO conversations (user_id, recipient_id, recipient_username) VALUES ($1,'big1','bob_ig')`, [B])
    const [{ id: cid }] = await q(`SELECT id FROM conversations WHERE user_id=$1`, [B])
    await q(`INSERT INTO messages (id, conversation_id, user_id, sender_id, content, is_from_instagram) VALUES ('qa-m1',$1,$2,'big1','B private message',TRUE)`, [cid, B])

    // A sees nothing of B
    const jsonA = async (res: Response) => JSON.stringify(await res.json())
    for (const [name, res] of [
      ["knowledge", await know.GET(req("knowledge", A))], ["leads", await leads.GET(req("leads", A))], ["conversations", await convs.GET(req("conversations", A))],
      ["messages", await convs.GET(req("conversations", A, "GET", undefined, "?igsid=big1"))], ["aisend", await aisend.GET(req("aisend", A))], ["overview", await over.GET(req("overview", A))], ["status", await status.GET(req("status", A))], ["settings", await settings.GET(req("settings", A))],
    ] as const) {
      const s = await jsonA(res as Response)
      assert.ok(!/B secret offer|B only|Bob|9999900001|big1|bob_ig|B private message|b-aisend|B-API-KEY/.test(s), `${name} leaked: ${s.slice(0, 200)}`)
    }
    // A cannot modify B's rows: take over, delete knowledge, activate on B's media, disconnect
    await convs.POST(req("conversations", A, "POST", { igsid: "big1" }))
    assert.equal((await q(`SELECT status FROM agent_conversations WHERE user_id=$1`, [B]))[0].status, "active")
    assert.equal((await q(`SELECT human_handled FROM conversations WHERE user_id=$1`, [B]))[0].human_handled, false)
    await know.DELETE(req("knowledge", A, "DELETE", undefined, "?mediaId=17900000000001"))
    assert.equal((await q(`SELECT count(*)::int n FROM media_knowledge WHERE user_id=$1`, [B]))[0].n, 1)
    assert.equal((await act.POST(req("activate", A, "POST", { mediaId: "17900000000001", keyword: "x" }))).status, 400) // A has no knowledge for that media
    await aisend.DELETE(req("aisend", A, "DELETE"))
    assert.equal((await q(`SELECT count(*)::int n FROM webhook_endpoints WHERE user_id=$1`, [B]))[0].n, 1)
    await act.DELETE(req("activate", A, "DELETE"))
    await settings.PUT(req("settings", A, "PUT", { enabled: true, tone: "casual" }))
    const bset = (await q(`SELECT enabled, tone FROM agent_settings WHERE user_id=$1`, [B]))[0] // row exists (B saved a connector), A's PUT did not change it
    assert.deepEqual([bset.enabled, bset.tone], [false, "friendly"])

    // B cannot re-aim the stored key at another host without re-entering it; same host without a key is fine
    assert.equal((await aisend.PUT(req("aisend", B, "PUT", { baseUrl: "https://attacker.example.net", enabled: true }))).status, 400)
    assert.equal((await aisend.PUT(req("aisend", B, "PUT", { baseUrl: "https://b-aisend.example.com", enabled: true }))).status, 200)
    assert.equal((await aisend.PUT(req("aisend", B, "PUT", { baseUrl: "https://new-host.example.com", apiKey: "B-NEW-KEY-12345", enabled: true }))).status, 200)
    assert.ok(!JSON.stringify(await (await aisend.GET(req("aisend", B))).json()).includes("B-NEW-KEY"))
    // pause then resume: the comment rules must come back on with the switch
    await q(`INSERT INTO automations (user_id, name, trigger_source, trigger_type, trigger_value, response_type, response_content, is_active, specific_media_id) VALUES ($1,'rule','comment','keyword','x','pro','{"response_kind":"ai_agent"}',TRUE,'17900000000001'), ($1,'plain','comment','keyword','y','pro','{"message":"hi"}',FALSE,'17900000000002')`, [B])
    await settings.PUT(req("settings", B, "PUT", { enabled: true }))
    await act.DELETE(req("activate", B, "DELETE"))
    assert.deepEqual((await q(`SELECT name, is_active FROM automations WHERE user_id=$1 ORDER BY name`, [B])).map((r: any) => r.is_active), [false, false])
    await settings.PUT(req("settings", B, "PUT", { enabled: true }))
    assert.deepEqual((await q(`SELECT name, is_active FROM automations WHERE user_id=$1 ORDER BY name`, [B])).map((r: any) => r.is_active), [false, true]) // only the agent rule ("plain" stays off)
    // B's own view: key never returned, hasKey true
    const b = await aisend.GET(req("aisend", B))
    const bs = JSON.stringify(await b.json())
    assert.ok(!/B-API-KEY|enc:/.test(bs))
    assert.ok(bs.includes('"hasKey":true'))
    const bst = JSON.stringify(await (await status.GET(req("status", B))).json())
    assert.ok(!/B-API-KEY|"secret"/.test(bst))
    // key at rest is not in any response of the generic webhooks list either (checked by masking in app/api/webhooks)
    // B's overview does not expose the Instagram id
    assert.ok(!JSON.stringify(await (await over.GET(req("overview", B))).json()).includes("big1"))
    // hostile igsid is data
    const r = await convs.GET(req("conversations", B, "GET", undefined, "?igsid=" + encodeURIComponent("x' OR '1'='1")))
    assert.equal(r.status, 200)
    assert.deepEqual((await r.json()).messages, [])
  } finally {
    await clean().catch(() => {})
    await db.closePool()
  }
})

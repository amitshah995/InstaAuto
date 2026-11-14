/**
 * /api/ai-agent/activate: wizard step 4. Creates or links the comment automation for the agent and switches it on.
 *  POST { mediaId, keyword } -> creates/updates the rule (trigger comment + keyword on that Reel, response_kind "ai_agent")
 *  DELETE -> pauses the agent (settings.enabled=false and its rules inactive)
 * Who calls it: components/ai-agent/SetupWizard.tsx and the overview on/off switch.
 * The rule is a normal row in `automations`, so it also shows up (and can be edited/deleted) under Automations.
 */
import { type NextRequest, NextResponse } from "next/server"
import { rawQuery } from "@/lib/supabase-server"
import { agentUser, failure } from "@/lib/agent/api"
import { createAgentStore } from "@/lib/agent/store"

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const u = agentUser(request, body?.userId)
  if (!u.ok) return u.res
  const mediaId = typeof body?.mediaId === "string" ? body.mediaId.trim() : ""
  const keyword = typeof body?.keyword === "string" ? body.keyword.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 80) : ""
  if (!/^\d{5,40}$/.test(mediaId)) return NextResponse.json({ error: "Choose a Reel first." }, { status: 400 })
  if (!keyword) return NextResponse.json({ error: "Enter the word people will comment, for example brochure." }, { status: 400 })
  try {
    const store = createAgentStore(rawQuery)
    const k = await store.getKnowledge(u.userId, mediaId)
    if (!k) return NextResponse.json({ error: "Add and activate knowledge for this Reel first (step 2)." }, { status: 400 })
    const content = JSON.stringify({ response_kind: "ai_agent", comment_scope: "specific", public_reply: { enabled: true, variants: ["Check your DMs! 📥", "Sent you a message 🙌", "Just messaged you ✅"] } })
    const existing = await rawQuery<{ id: string }>(
      `SELECT id FROM automations WHERE user_id = $1 AND specific_media_id = $2 AND response_content->>'response_kind' = 'ai_agent' LIMIT 1`,
      [u.userId, mediaId],
    )
    let ruleId: string
    if (existing[0]) {
      ruleId = existing[0].id
      await rawQuery(`UPDATE automations SET trigger_value = $3, is_active = TRUE, response_content = $4::jsonb WHERE id = $2 AND user_id = $1`, [u.userId, ruleId, keyword, content])
    } else {
      const rows = await rawQuery<{ id: string }>(
        `INSERT INTO automations (user_id, name, trigger_source, trigger_type, trigger_value, response_type, response_content, is_active, specific_media_id)
         VALUES ($1,$2,'comment','keyword',$3,'pro',$4::jsonb,TRUE,$5) RETURNING id`,
        [u.userId, `AI Sales Agent: ${k.title || mediaId}`.slice(0, 120), keyword, content, mediaId],
      )
      ruleId = rows[0].id
    }
    await store.saveSettings(u.userId, { enabled: true })
    return NextResponse.json({ ok: true, ruleId })
  } catch (e) {
    return failure("activate POST", e)
  }
}

export async function DELETE(request: NextRequest) {
  const u = agentUser(request)
  if (!u.ok) return u.res
  try {
    await rawQuery(`UPDATE automations SET is_active = FALSE WHERE user_id = $1 AND response_content->>'response_kind' = 'ai_agent'`, [u.userId])
    await createAgentStore(rawQuery).saveSettings(u.userId, { enabled: false })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return failure("activate DELETE", e)
  }
}

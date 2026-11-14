/**
 * /api/ai-agent/settings: tone, language, handoff rules, lead score numbers, agent on/off.
 *  GET -> settings | PUT { tone?, language?, handoffRules?, scores?, enabled?, connectorSkipped?, settingsSaved? }
 * Who calls it: the setup wizard (step 3), the Settings tab and the overview on/off switch.
 */
import { type NextRequest, NextResponse } from "next/server"
import { rawQuery } from "@/lib/supabase-server"
import { agentUser, failure } from "@/lib/agent/api"
import { createAgentStore } from "@/lib/agent/store"
import { clampScores } from "@/lib/agent/scoring"
import { LANGUAGES, TONES } from "@/lib/agent/types"
import { CONSENT_LINE, EMAIL_OFFER_LINE } from "@/lib/agent/consent"

export async function GET(request: NextRequest) {
  const u = agentUser(request)
  if (!u.ok) return u.res
  try {
    return NextResponse.json({ settings: await createAgentStore(rawQuery).getSettings(u.userId), consentLine: CONSENT_LINE, emailOfferLine: EMAIL_OFFER_LINE })
  } catch (e) {
    return failure("settings GET", e)
  }
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const u = agentUser(request, body?.userId)
  if (!u.ok) return u.res
  try {
    const store = createAgentStore(rawQuery)
    const cur = await store.getSettings(u.userId)
    const patch: Partial<typeof cur> = {}
    if (TONES.includes(body.tone)) patch.tone = body.tone
    if (LANGUAGES.includes(body.language)) patch.language = body.language
    if (typeof body.handoffRules === "string") patch.handoffRules = body.handoffRules.slice(0, 600)
    if (body.scores) patch.scores = clampScores(body.scores, cur.scores)
    if (typeof body.enabled === "boolean") patch.enabled = body.enabled
    if (typeof body.connectorSkipped === "boolean") patch.connectorSkipped = body.connectorSkipped
    if (body.settingsSaved === true) patch.settingsSaved = true
    await store.saveSettings(u.userId, patch)
    // Turning the agent back on (Overview switch) must also switch its comment rules back on: DELETE /activate turned them off.
    if (patch.enabled === true && cur.enabled === false) {
      await rawQuery(`UPDATE automations SET is_active = TRUE WHERE user_id = $1 AND response_content->>'response_kind' = 'ai_agent'`, [u.userId])
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return failure("settings PUT", e)
  }
}

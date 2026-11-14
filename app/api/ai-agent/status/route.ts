/**
 * GET /api/ai-agent/status: everything the setup wizard needs in one call (done/not-done per step, settings, connector
 * state without the key, knowledge list, agent rules, whether the server has a model key).
 * Who calls it: components/ai-agent/SetupWizard.tsx and the overview tab.
 */
import { NextResponse, type NextRequest } from "next/server"
import { rawQuery } from "@/lib/supabase-server"
import { agentUser, failure } from "@/lib/agent/api"
import { createAgentStore } from "@/lib/agent/store"
import { computeWizard } from "@/lib/agent/wizard"
import { agentEnabled } from "@/lib/agent/engine"
import { CONSENT_LINE, EMAIL_OFFER_LINE } from "@/lib/agent/consent"

export async function GET(request: NextRequest) {
  const u = agentUser(request)
  if (!u.ok) return u.res
  try {
    const store = createAgentStore(rawQuery)
    const [settings, connector, knowledge, rules] = await Promise.all([store.getSettings(u.userId), store.getConnector(u.userId), store.listKnowledge(u.userId), store.listAgentRules(u.userId)])
    const wizard = computeWizard({
      connectorConfigured: !!connector && connector.enabled === true,
      connectorSkipped: settings.connectorSkipped,
      knowledgeCount: knowledge.filter((k) => k.active).length,
      settingsSaved: settings.settingsSaved,
      ruleActive: rules.some((r: any) => r.is_active === true),
      agentEnabled: settings.enabled,
    })
    return NextResponse.json({
      wizard, settings, knowledge, consentLine: CONSENT_LINE, emailOfferLine: EMAIL_OFFER_LINE,
      connector: connector ? { configured: true, enabled: connector.enabled === true, disabledReason: connector.disabled_reason ?? null } : { configured: false, enabled: false, disabledReason: null },
      rules: rules.map((r: any) => ({ id: r.id, name: r.name, keyword: r.trigger_value, mediaId: r.specific_media_id, active: r.is_active === true })),
      modelConfigured: agentEnabled(),
    })
  } catch (e) {
    return failure("status", e)
  }
}

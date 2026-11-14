/**
 * GET /api/ai-agent/overview: on/off, conversations today, leads captured (WhatsApp / email), handoffs, score distribution,
 * last 10 leads. Aggregation is lib/agent/overview.ts (pure). Everything is scoped to the session user.
 */
import { NextResponse, type NextRequest } from "next/server"
import { rawQuery } from "@/lib/supabase-server"
import { agentUser, failure } from "@/lib/agent/api"
import { createAgentStore } from "@/lib/agent/store"
import { aggregateOverview } from "@/lib/agent/overview"

export async function GET(request: NextRequest) {
  const u = agentUser(request)
  if (!u.ok) return u.res
  try {
    const store = createAgentStore(rawQuery)
    const [settings, convs, leads] = await Promise.all([store.getSettings(u.userId), store.listConversations(u.userId, 200), store.listLeads(u.userId, undefined, 500)])
    const overview = aggregateOverview(
      convs.map((c: any) => ({ status: c.status, startedAt: c.started_at, updatedAt: c.updated_at })),
      leads.map((l: any) => ({ id: l.id, igsid: l.igsid, name: l.name ?? null, username: l.recipient_username ?? null, status: l.lead_status, score: Number(l.lead_score) || 0, updatedAt: l.lead_updated_at ?? "" })),
      new Date(),
    )
    // The Instagram id is not needed in the browser overview.
    return NextResponse.json({ enabled: settings.enabled, ...overview, lastLeads: overview.lastLeads.map(({ igsid: _i, ...rest }) => rest) })
  } catch (e) {
    return failure("overview", e)
  }
}

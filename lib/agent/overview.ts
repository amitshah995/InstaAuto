/**
 * Overview numbers for the AI Sales Agent tab. Pure aggregation over rows the API already loaded (all scoped to one user).
 *
 * Who calls this: app/api/ai-agent/overview.
 */
import { SCORE_BUCKETS, scoreBucket } from "./scoring.ts"

export interface ConvRow { status: string; startedAt: string; updatedAt: string }
export interface LeadRow { id: string; igsid: string; name: string | null; username?: string | null; status: string; score: number; updatedAt: string }

export interface Overview {
  conversationsToday: number
  activeConversations: number
  whatsappLeads: number
  emailLeads: number
  handoffs: number
  scoreDistribution: Record<(typeof SCORE_BUCKETS)[number], number>
  lastLeads: LeadRow[]
}

const sameUtcDay = (iso: string, now: Date) => {
  const t = Date.parse(iso)
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === now.toISOString().slice(0, 10)
}

export function aggregateOverview(convs: ConvRow[], leads: LeadRow[], now: Date): Overview {
  const dist = Object.fromEntries(SCORE_BUCKETS.map((b) => [b, 0])) as Overview["scoreDistribution"]
  for (const l of leads) dist[scoreBucket(l.score)]++
  const sorted = [...leads].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
  return {
    conversationsToday: convs.filter((c) => sameUtcDay(c.startedAt, now)).length,
    activeConversations: convs.filter((c) => c.status === "active").length,
    whatsappLeads: leads.filter((l) => l.status === "wa_lead").length,
    emailLeads: leads.filter((l) => l.status === "email_lead").length,
    handoffs: convs.filter((c) => c.status === "handoff").length,
    scoreDistribution: dist,
    lastLeads: sorted.slice(0, 10),
  }
}

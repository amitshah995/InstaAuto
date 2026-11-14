/**
 * GET /api/ai-agent/leads?status=wa_lead|email_lead|engaged|handoff|new -> leads with status and score for the Leads tab.
 * CSV export of the same list: /api/contacts/export?lead_status=<status|all> (existing export, extended).
 * Phones/emails are shown to the account that owns them only.
 */
import { NextResponse, type NextRequest } from "next/server"
import { rawQuery } from "@/lib/supabase-server"
import { agentUser, failure } from "@/lib/agent/api"
import { createAgentStore } from "@/lib/agent/store"

export async function GET(request: NextRequest) {
  const u = agentUser(request)
  if (!u.ok) return u.res
  try {
    const rows = await createAgentStore(rawQuery).listLeads(u.userId, request.nextUrl.searchParams.get("status") || undefined, 200)
    return NextResponse.json({
      leads: rows.map((l: any) => ({ id: l.id, username: l.recipient_username ?? null, name: l.name ?? null, status: l.lead_status, score: Number(l.lead_score) || 0, mediaId: l.lead_media_id ?? null, phone: l.phone ?? null, email: l.email ?? null, updatedAt: l.lead_updated_at })),
    })
  } catch (e) {
    return failure("leads", e)
  }
}

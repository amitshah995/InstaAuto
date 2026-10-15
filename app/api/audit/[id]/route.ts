import { type NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth"
import { getAuditView } from "@/lib/audit/service"

// GET /api/audit/[id]
//  - anonymous / not the owner: { id, unlocked:false, teaser }   (NO report field)
//  - owner (claimed the audit):  { id, unlocked:true,  teaser, report }
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const view = await getAuditView(id, getSessionUserId(request))
  if (!view) return NextResponse.json({ error: "Audit not found" }, { status: 404 })
  return NextResponse.json(view, { headers: { "Cache-Control": "private, no-store" } })
}

import { type NextRequest, NextResponse } from "next/server"
import { getVerifiedSessionUserId } from "@/lib/auth"
import { getAuditView } from "@/lib/audit/service"

// GET /api/audit/[id] - owner only. Anyone else (anonymous included) gets 404, so ids reveal nothing.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const view = await getAuditView(id, getVerifiedSessionUserId(request))
  if (!view) return NextResponse.json({ error: "Audit not found" }, { status: 404 })
  return NextResponse.json(view, { headers: { "Cache-Control": "private, no-store" } })
}

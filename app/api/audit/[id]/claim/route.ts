import { type NextRequest, NextResponse } from "next/server"
import { getSessionUserId } from "@/lib/auth"
import { claimAudit } from "@/lib/audit/service"

// POST /api/audit/[id]/claim - unlock the full report for the signed-in user.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getSessionUserId(request)
  if (!userId) return NextResponse.json({ error: "Sign in to unlock the report" }, { status: 401 })

  const { id } = await params
  const result = await claimAudit(id, userId)
  switch (result) {
    case "claimed":
    case "already_yours":
      return NextResponse.json({ success: true })
    case "taken":
      return NextResponse.json(
        { error: "This report was already unlocked by another account. Run your own audit to get yours." },
        { status: 409 }
      )
    default:
      return NextResponse.json({ error: "Audit not found" }, { status: 404 })
  }
}

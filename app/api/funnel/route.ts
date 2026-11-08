import { type NextRequest, NextResponse } from "next/server"
import { getVerifiedSessionUserId } from "@/lib/auth"
import { getFunnel } from "@/lib/funnel"

// GET /api/funnel?days=30 : per-post (per-automation) funnel for the signed-in account only.
export async function GET(request: NextRequest) {
  const userId = getVerifiedSessionUserId(request)
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const d = Number(request.nextUrl.searchParams.get("days") || 30)
  const days = [7, 30, 90].includes(d) ? d : 30
  return NextResponse.json(await getFunnel(userId, days))
}

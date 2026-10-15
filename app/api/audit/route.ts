import { type NextRequest, NextResponse } from "next/server"
import { getVerifiedSessionUserId } from "@/lib/auth"
import { LookupError } from "@/lib/audit/lookup"
import { createOwnAudit } from "@/lib/audit/service"

// POST /api/audit (signed-in) -> { id }
// Audits the signed-in user's own Instagram account. 401 means "connect Instagram first".
export const maxDuration = 30

export async function POST(request: NextRequest) {
  const userId = getVerifiedSessionUserId(request)
  if (!userId) {
    return NextResponse.json({ error: "Connect your Instagram account to run your audit.", code: "login_required" }, { status: 401 })
  }

  try {
    const { id } = await createOwnAudit(userId)
    return NextResponse.json({ id })
  } catch (e: any) {
    if (e instanceof LookupError) {
      if (e.code === "reconnect_required") {
        return NextResponse.json(
          { error: "Your Instagram connection expired. Please connect again.", code: "login_required" },
          { status: 401 }
        )
      }
      if (e.code === "rate_limited") {
        return NextResponse.json({ error: "Instagram is busy right now. Please try again in a few minutes." }, { status: 429 })
      }
      console.error("[audit] provider unavailable:", e.message)
      return NextResponse.json({ error: "We could not read your Instagram data right now. Please try again later." }, { status: 503 })
    }
    console.error("[audit] unexpected error:", e)
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 })
  }
}

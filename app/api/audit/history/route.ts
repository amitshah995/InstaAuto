import { type NextRequest, NextResponse } from "next/server"
import { getVerifiedSessionUserId } from "@/lib/auth"
import { rawQuery } from "@/lib/supabase-server"

// GET /api/audit/history : the signed-in owner's own finished audits (score over time), oldest first.
// Owner only. Anyone not signed in gets 401, and only that user's rows are ever read.
export async function GET(request: NextRequest) {
  const userId = getVerifiedSessionUserId(request)
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  try {
    const rows = await rawQuery<{ id: string; score: number; created_at: string }>(
      `SELECT id, score, created_at FROM audits
        WHERE user_id = $1 AND status = 'ready' AND score IS NOT NULL
        ORDER BY created_at DESC LIMIT 30`,
      [userId],
    )
    const points = rows.reverse().map((r) => ({ id: r.id, score: r.score, at: new Date(r.created_at).toISOString() }))
    return NextResponse.json({ points }, { headers: { "Cache-Control": "private, no-store" } })
  } catch {
    return NextResponse.json({ points: [] })
  }
}

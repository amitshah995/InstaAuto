import { type NextRequest, NextResponse } from "next/server"
import { getSessionUserId, getVerifiedSessionUserId } from "@/lib/auth"
import { rawQuery } from "@/lib/supabase-server"

// GET /api/audit/session: who the server thinks is signed in, plus their latest audit.
// Why: the browser keeps its own hint in localStorage, but the httpOnly cookie is the only thing the
// audit API trusts. The audit page asks the server so it never offers "Connect" to someone who is
// already signed in, and can explain exactly why a reconnect is needed when it truly is.
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "private, no-store" }
  const userId = getVerifiedSessionUserId(request)
  if (!userId) {
    // A legacy unsigned cookie is a real login from an older version; it just cannot run the audit.
    const legacy = !!getSessionUserId(request)
    return NextResponse.json({ signedIn: false, reason: legacy ? "session_upgrade" : "no_session" }, { headers })
  }
  try {
    const [u] = await rawQuery<{ username: string | null; has_token: boolean }>(
      `SELECT username, (access_token IS NOT NULL AND access_token <> '') AS has_token FROM users WHERE id = $1 LIMIT 1`,
      [userId],
    )
    if (!u) return NextResponse.json({ signedIn: false, reason: "no_account" }, { headers })
    const [latest] = await rawQuery<{ id: string; score: number; created_at: string }>(
      `SELECT id, score, created_at FROM audits WHERE user_id = $1 AND status = 'ready' AND score IS NOT NULL ORDER BY created_at DESC LIMIT 1`,
      [userId],
    ).catch(() => [] as any[])
    return NextResponse.json(
      {
        signedIn: true,
        username: u.username,
        // No stored token means Instagram access was revoked or never completed: running will need a reconnect.
        needsReconnect: !u.has_token,
        latest: latest ? { id: latest.id, score: latest.score, createdAt: new Date(latest.created_at).toISOString() } : null,
      },
      { headers },
    )
  } catch (e) {
    console.error("[audit/session] error:", (e as Error)?.message)
    return NextResponse.json({ signedIn: true, username: null, needsReconnect: false, latest: null }, { headers })
  }
}

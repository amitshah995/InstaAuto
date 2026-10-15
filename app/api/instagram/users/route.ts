import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase-server"
import { getSessionUserId, isEnforced } from "@/lib/auth"

// GET /api/instagram/users - List connected Instagram accounts
//
// SECURITY: this used to be public and returned every account's id + username.
// - AUTH_ENFORCE=1: requires a session and returns ONLY the caller's own account.
// - otherwise (legacy): still lists all accounts because the Android app uses this
//   endpoint as its "login" (it lets you pick an account). That Android flow must be
//   replaced with the real OAuth flow + Bearer sessionToken before enforcing.
export async function GET(request: NextRequest) {
  try {
    const sessionUserId = getSessionUserId(request)

    if (isEnforced() && !sessionUserId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }
    if (!sessionUserId) {
      console.warn("[auth] /api/instagram/users listed all accounts to an unauthenticated caller (legacy)")
    }

    const supabase = await getSupabaseServerClient()
    let query = supabase
      .from("users")
      .select("id, username, business_account_id, updated_at")
    if (isEnforced() && sessionUserId) query = query.eq("id", sessionUserId)
    const { data, error } = await query.order("updated_at", { ascending: false })

    if (error) throw error

    return NextResponse.json({
      success: true,
      users: (data || []).map((u: any) => ({
        userId: u.id,
        username: u.username,
        businessAccountId: u.business_account_id,
        updatedAt: u.updated_at,
      })),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase-server"
import { getSessionUserId } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    const userId = getSessionUserId(request)
    if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

    const supabase = await getSupabaseServerClient()
    const { data, error } = await supabase
      .from("contacts")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) throw error
    return NextResponse.json(data)
  } catch (error) {
    console.error("[Contacts] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch contacts" }, { status: 500 })
  }
}

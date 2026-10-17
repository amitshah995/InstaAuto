import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase-server"
import { getSessionUserId } from "@/lib/auth"
import { snapshotAutomation } from "@/lib/flows/versions"

// GET ?id=<automationId>  -> recent versions (newest first), owner only.
export async function GET(request: NextRequest) {
  const userId = getSessionUserId(request)
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const id = request.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
  try {
    const supabase = await getSupabaseServerClient()
    const { data, error } = await supabase
      .from("automation_versions")
      .select("id, name, trigger_value, created_at")
      .eq("automation_id", id)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10)
    if (error) throw error
    return NextResponse.json(data || [])
  } catch (e) {
    console.error("[versions] GET error:", e)
    return NextResponse.json({ error: "Version history is not set up yet (run migration 14)." }, { status: 500 })
  }
}

// POST { id, versionId } -> restore that version (the current state is saved as a version first).
export async function POST(request: NextRequest) {
  const userId = getSessionUserId(request)
  if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  const body = await request.json().catch(() => null)
  const id = body?.id
  const versionId = body?.versionId
  if (!id || !versionId) return NextResponse.json({ error: "Missing fields" }, { status: 400 })
  try {
    const supabase = await getSupabaseServerClient()
    const { data: v } = await supabase
      .from("automation_versions")
      .select("*")
      .eq("id", versionId)
      .eq("automation_id", id)
      .eq("user_id", userId)
      .single()
    if (!v) return NextResponse.json({ error: "Version not found" }, { status: 404 })

    await snapshotAutomation(id, userId)
    const { data, error } = await supabase
      .from("automations")
      .update({ name: v.name, trigger_value: v.trigger_value, response_content: v.response_content })
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single()
    if (error) throw error
    if (!data) return NextResponse.json({ error: "Automation not found" }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[versions] restore error:", e)
    return NextResponse.json({ error: "Restore failed" }, { status: 500 })
  }
}

import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase-server"
import { getSessionUserId } from "@/lib/auth"

function csvEscape(value: any): string {
  const str = value === null || value === undefined ? "" : String(value)
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

export async function GET(request: NextRequest) {
  try {
    const userId = getSessionUserId(request)
    if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

    const supabase = await getSupabaseServerClient()
    // Optional lead filter used by the AI Sales Agent "Leads" tab: ?lead_status=all|wa_lead|email_lead|engaged|handoff|new.
    // Without it the export is exactly as before (same columns).
    const leadStatus = request.nextUrl.searchParams.get("lead_status")
    let query = supabase.from("contacts").select("*").eq("user_id", userId)
    if (leadStatus && leadStatus !== "all") query = query.eq("lead_status", leadStatus)
    const { data: contacts, error } = await query.order("created_at", { ascending: false })

    if (error) throw error

    // Collect every distinct custom_fields key across all contacts, so the CSV
    // has a stable set of columns even when different flows ask different questions.
    const customKeys = new Set<string>()
    for (const c of contacts || []) {
      for (const key of Object.keys(c.custom_fields || {})) customKeys.add(key)
    }
    const customKeyList = Array.from(customKeys)

    const leadCols = leadStatus ? ["lead_status", "lead_score", "phone_consent_at", "consent_text"] : []
    const headers = ["igsid", "name", "email", "phone", "tags", ...leadCols, ...customKeyList, "created_at"]
    const rows = (contacts || []).map((c: any) => [
      c.igsid,
      c.name || "",
      c.email || "",
      c.phone || "",
      (Array.isArray(c.tags) ? c.tags : []).join(";"),
      ...leadCols.map((k) => c[k] ?? ""),
      ...customKeyList.map((k) => c.custom_fields?.[k] ?? ""),
      c.created_at,
    ])

    const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n")

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="contacts-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  } catch (error) {
    console.error("[Contacts Export] Error:", error)
    return NextResponse.json({ error: "Failed to export contacts" }, { status: 500 })
  }
}

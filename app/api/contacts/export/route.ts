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
    const { data: contacts, error } = await supabase
      .from("contacts")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) throw error

    // Collect every distinct custom_fields key across all contacts, so the CSV
    // has a stable set of columns even when different flows ask different questions.
    const customKeys = new Set<string>()
    for (const c of contacts || []) {
      for (const key of Object.keys(c.custom_fields || {})) customKeys.add(key)
    }
    const customKeyList = Array.from(customKeys)

    const headers = ["igsid", "name", "email", "phone", ...customKeyList, "created_at"]
    const rows = (contacts || []).map((c: any) => [
      c.igsid,
      c.name || "",
      c.email || "",
      c.phone || "",
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

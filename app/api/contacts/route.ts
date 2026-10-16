import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase-server"
import { getSessionUserId } from "@/lib/auth"
import { z } from "zod"
import { applyTagChange } from "@/lib/contacts/segments"

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

const PatchSchema = z.object({
  ids: z.array(z.union([z.string(), z.number()])).min(1).max(500),
  addTags: z.array(z.string()).max(20).optional(),
  removeTags: z.array(z.string()).max(20).optional(),
  notes: z.string().max(2000).nullable().optional(),
  name: z.string().max(120).nullable().optional(),
})

// Bulk-safe update: add/remove tags on one or many contacts, or set notes/name (single id).
export async function PATCH(request: NextRequest) {
  try {
    const userId = getSessionUserId(request)
    if (!userId) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

    const parsed = PatchSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    const { ids, addTags, removeTags, notes, name } = parsed.data
    if ((notes !== undefined || name !== undefined) && ids.length !== 1) {
      return NextResponse.json({ error: "notes/name can only be set on one contact" }, { status: 400 })
    }

    const supabase = await getSupabaseServerClient()
    let updated = 0
    for (const id of ids) {
      // Scoped by user_id so one account can never edit another's contacts.
      const { data: row } = await supabase.from("contacts").select("id, tags").eq("id", id).eq("user_id", userId).single()
      if (!row) continue
      const patch: any = { updated_at: new Date().toISOString() }
      if (addTags || removeTags) patch.tags = applyTagChange(row.tags, addTags, removeTags)
      if (notes !== undefined) patch.notes = notes
      if (name !== undefined) patch.name = name
      const { error } = await supabase.from("contacts").update(patch).eq("id", id).eq("user_id", userId)
      if (!error) updated++
    }
    return NextResponse.json({ updated })
  } catch (error) {
    console.error("[Contacts] PATCH error:", error)
    return NextResponse.json({ error: "Failed to update contacts" }, { status: 500 })
  }
}

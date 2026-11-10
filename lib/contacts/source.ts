/**
 * Where a contact came from, stored as the custom field `source` on the contact (contacts.custom_fields.source).
 *
 * Who calls this: app/api/instagram/webhook/route.ts when someone opens a ref link (value "ref:<code>"); the value shows
 * up in Contacts, in CSV export and can be used by flow conditions as the variable `source`.
 * Why it exists: lets the owner see which link, QR code or ad brought a person in. No migration needed: custom_fields
 * is an existing JSONB column.
 * Rule: first touch wins. The source is written once and never replaced, so later links do not hide the original one.
 */

/** Pure: returns the custom_fields to save, or null when nothing should change (a source already exists). */
export function mergeContactSource(existing: Record<string, unknown> | null | undefined, source: string): Record<string, unknown> | null {
  const cleaned = String(source ?? "").trim().slice(0, 80)
  if (!cleaned) return null
  const current = existing && typeof existing === "object" ? existing : {}
  if (typeof current.source === "string" && current.source.trim()) return null
  return { ...current, source: cleaned }
}

/** Saves the source for a contact (creating the contact if needed). Never throws; returns true when something was written. */
export async function recordContactSource(supabase: any, userId: number, igsid: string, source: string): Promise<boolean> {
  try {
    const { data: existing } = await supabase.from("contacts").select("id, custom_fields").eq("user_id", userId).eq("igsid", igsid).single()
    const merged = mergeContactSource(existing?.custom_fields, source)
    if (!merged) return false
    const now = new Date().toISOString()
    if (existing) {
      const { error } = await supabase.from("contacts").update({ custom_fields: merged, updated_at: now }).eq("id", existing.id)
      return !error
    }
    const { error } = await supabase.from("contacts").insert({ user_id: userId, igsid, custom_fields: merged, created_at: now, updated_at: now })
    return !error
  } catch (e) {
    console.error("[contacts] could not record source:", e)
    return false
  }
}

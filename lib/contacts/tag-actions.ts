import { getSupabaseServerClient } from "@/lib/supabase-server"
import { applyTagChange, cleanTag } from "@/lib/contacts/segments"

/** Adds a tag to a contact (creating the contact row if needed). Never throws. */
export async function addTagToContact(userId: number, igsid: string, rawTag: string): Promise<boolean> {
  const tag = cleanTag(rawTag)
  if (!tag) return false
  try {
    const supabase = await getSupabaseServerClient()
    const { data: existing } = await supabase
      .from("contacts")
      .select("id, tags")
      .eq("user_id", userId)
      .eq("igsid", igsid)
      .single()
    const now = new Date().toISOString()
    if (existing) {
      const { error } = await supabase
        .from("contacts")
        .update({ tags: applyTagChange(existing.tags, [tag], []), updated_at: now })
        .eq("id", existing.id)
      return !error
    }
    const { error } = await supabase
      .from("contacts")
      .insert({ user_id: userId, igsid, tags: [tag], created_at: now, updated_at: now })
    return !error
  } catch (e) {
    console.error("[flow] tag action failed:", e)
    return false
  }
}
